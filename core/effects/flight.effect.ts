import { Injectable } from '@angular/core';
import { Observable, of, concat, combineLatest } from 'rxjs';
import { Store, Action } from '@ngrx/store';
import { Actions, concatLatestFrom, createEffect, ofType } from '@ngrx/effects';
import { mergeMap, map, catchError, switchMap, take, tap, filter } from 'rxjs/operators';
import * as moment from 'moment';

import { CoreState } from '../reducers';
import {
	AppClearErrors, AppAddError, FlightActionTypes, FlightActions, BookingActions, SsrLoadAvailability, NavigationActions, BundleShowOffer, PackageNavigate,
	GtmImpressionFlight, PackageActionTypes, AppResetSession, GtmUserDetails, GtmFlightsAvailable, UserActions, UserActionTypes, GetPointBaseMultipliers, AvailabilitySetSearchInput, BundleManageGetPricing
} from '../actions';
import { AvailabilitySelectors, routerCurrentFlowState, FlightSelectors, authLoggedInState, ResourceSelectors, UserSelectors, routerCurrentUrlNoParamsState, BookingSelectors, packageSearchResultState } from '../selectors';
import { FlightService, ModalService, SessionStorageService } from '../../services';
import { SeasonalServiceNoticeModel, JourneyModel, FareModel, FaresModel, AvailabilitySearchSubType, AvailabilitySearchType, ClubUpsellResponse, SubFlow, ModalOptionsModel } from '../../models';
import { EarlyFlightModalComponent, SeasonalServiceModalComponent, ClubUpsellModalComponent, InsufficientPointsModalComponent, ModifyFlightModalComponent } from '../../../shared/components/modals';

import FeatureFlags from '../../../../assets/config/feature-flags.json';
import { FeatureFlagType } from '../../models/feature-flag-type.model';

@Injectable()
export class FlightEffects {
	featureFlags: FeatureFlagType = FeatureFlags;
	isInsufficientForPaymentCalled = false;

	constructor(
		private actions$: Actions,
		private store: Store<CoreState>,
		private flightService: FlightService,
		private modalService: ModalService,
		private storage: SessionStorageService,
	) { }

	combinationSearch$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.CombinationSearch>(FlightActionTypes.COMBINATION_SEARCH),
			concatLatestFrom(() => [this.store.select(AvailabilitySelectors.flightSearch)]),
			mergeMap(([action, search]) => {
				const { defaultJourneyKey, orgCode, ...lowFareSearch } = search;

				return [
					new AppClearErrors(),
					new FlightActions.ClearSearchResults(),
					new FlightActions.ValidateSearchDates(search, [
						new FlightActions.ValidateSeasonalService(search, [
							new FlightActions.LowFareSearch({
								...lowFareSearch,
								criteria: search.criteria.map(c => ({
									...c,
									beginDate: moment(c.date).startOf('day').subtract(3, 'days').toDate(),
									endDate: moment(c.date).startOf('day').add(3, 'days').toDate(),
									selectedDate: c.date
								}))
							}, []),
							new FlightActions.Search(search),
							new FlightActions.Navigate(action.type),
							new FlightActions.PointCashFare(search.originalBookingRecordLocator ? search.usePoints && !search.originallyPointsOnlyBooking ? 'Pc' : 'P' : ''),
							...action.next
						])
					])
				];
			})
		));

	validateSearchDates$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.ValidateSearchDates>(FlightActionTypes.VALIDATE_SEARCH_DATES),
			concatLatestFrom(() => [this.store.select(AvailabilitySelectors.searchInput)]),
			mergeMap(([action, searchInput]) => {

				if (searchInput.subType === AvailabilitySearchSubType.multiCity) {
					return action.next;
				}

				let previousDeparture: moment.Moment;

				return action.payload.criteria.reduce((next, c) => {
					const currentDeparture = moment(c.date);

					if (!previousDeparture || currentDeparture >= previousDeparture) {
						previousDeparture = currentDeparture;
						return next;
					}

					return [new AppAddError({ key: 'invalid-search-dates' })];
				}, action.next);
			})
		));

	validateSeasonalService$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.ValidateSeasonalService>(FlightActionTypes.VALIDATE_SEASONAL_SERVICE),
			concatLatestFrom(() => [this.store.select(ResourceSelectors.seasonalServiceNotices)]),
			mergeMap(([action, seasonalServiceNotices]) => {
				const applicableNotices: SeasonalServiceNoticeModel[] = seasonalServiceNotices.filter(notice => action.payload.criteria.some(c =>
					((c.originStationCode === notice.fromStationCode) || notice.fromStationCode === 'ANY') &&
					((c.destinationStationCode === notice.toStationCode) || notice.toStationCode === 'ANY') &&
					moment(c.date).isBetween(notice.startDate, notice.endDate))
				);

				if (applicableNotices.length > 0) {
					this.modalService.open(SeasonalServiceModalComponent, { initialState: { message: applicableNotices[0].message } });
					return [];
				}

				return action.next;
			})
		));

	validateFareSelections$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.ValidateFareSelections>(FlightActionTypes.VALIDATE_FARE_SELECTIONS),
			concatLatestFrom(() => [
				this.store.select(FlightSelectors.fareSelections),
				this.store.select(FlightSelectors.searchResult),
				this.store.select(BookingSelectors.activeJourneys)
			]),
			mergeMap(([action, fareSelections, searchResult, journeys]) => {
				let previousDeparture: moment.Moment;
				let errorFound = false;

				// Check Modify flight path for departure conflict.
				const journeyDepartures = [];
				let errorAction: Action[];
				if (journeys && journeys.length > 0) {
					journeys.map((j, i) => {
						const fs = fareSelections['' + i];
						journeyDepartures[i] = fs ? fareSelections['' + i].journey.designator.departure : j.designator.departure;
					});

					journeyDepartures.map(jd => {
						if (!errorAction) {
							if (previousDeparture && jd <= previousDeparture) {
								errorAction = [new AppAddError({ key: 'invalid-fare-selections' })];
							}
							previousDeparture = jd;
						}
					});
				}
				if (errorAction) {
					return errorAction;
				}

				// this is only handling departures conflicts, for departure vs arrival overlaps in the case of roundtrip we rely on the error from the server to show the error message
				return Object.keys(fareSelections).sort((a, b) => Number(a) - Number(b)).reduce<Action[]>((next, key) => {
					const currentDeparture = moment(fareSelections[key].journey.designator.departure);

					if (!errorFound) {
						if (previousDeparture && currentDeparture <= previousDeparture) {
							errorFound = true;
							return [new AppAddError({ key: 'invalid-fare-selections' })];
						}
						previousDeparture = currentDeparture;

						if (!searchResult || !searchResult.data.trips.some(t => t.journeysAvailable.some(j => j.journeyKey === fareSelections[key].journey.journeyKey))) {
							errorFound = true;
							return [new AppAddError({ key: 'invalid-fare-selection-journey-not-found' })];
						}
						// either fare should be found in normal fares or pointCash fares
						const fareNotFound = !searchResult.data.trips.some(t => t.journeysAvailable.some(j => Object.keys(j.fares).some(k => k === fareSelections[key].fare.fareAvailabilityKey)));
						const pointCashFareNotFound = !searchResult.data.trips.some(t => t.journeysAvailable.some(j => j.pointCashFares && Object.keys(j.pointCashFares).some(k => k === fareSelections[key].fare.fareAvailabilityKey)));
						if (!searchResult || (fareNotFound && pointCashFareNotFound)) {
							errorFound = true;
							return [new AppAddError({ key: 'invalid-fare-selection-fare-not-found' })];
						}
					}

					return next;
				}, action.next);
			})
		));

	validateAndUpdateFareSelection$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.ValidateAndUpdateFareSelection>(FlightActionTypes.VALIDATE_AND_UPDTAE_FARE_SELECTION),
			concatLatestFrom(() => [
				this.store.select(FlightSelectors.searchResult),
				this.store.select(FlightSelectors.fareSelections),
				this.store.select(AvailabilitySelectors.searchInput)
			]),
			filter(([, r, f, i]) => i.subType === AvailabilitySearchSubType.roundTrip && !i.usePoints && !!f && !!(r && r.data && r.data.trips)),
			switchMap(([, r, f, _]) => {
				let next = [];
				Object.keys(f).sort((a, b) => Number(a) - Number(b)).forEach((key, index) => {
					if (next.length === 0 && !r.data.trips.some(t => t.journeysAvailable.some(j => Object.keys(j.fares).some(k => k === f[key].fare.fareAvailabilityKey)))) {
						// Will handle fareAvailabilityKey mismatch edge case for international partial flight search on availability page
						const selectedJourney = r.data.trips.map(t => t.journeysAvailable.find(j => j.journeyKey === f[key].journey.journeyKey));
						next = (selectedJourney && selectedJourney.length > 0 && selectedJourney[index]) ? [new FlightActions.SetFareSelection({
							index,
							journeyFare: {
								journey: selectedJourney[index],
								fare: (f[key].fare.productClass === 'RO') ? selectedJourney[index].clubFare : selectedJourney[index].standardFare
							}
						})] : [];
					}
				});
				return next;
			})
		));

	/* pointsAndCash feature Flag off SearchforPointonly Apply */
	searchForPointsOnly$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.Search>(FlightActionTypes.SEARCH),
			filter((action) => !(this.featureFlags && this.featureFlags.pointsAndCash) || !action.payload.usePoints),
			tap(() => this.storage.setItem('gtmSearchTime', new Date().toLocaleTimeString('en-US', { hour12: false }), true)),
			mergeMap(action => concat(
				[new FlightActions.SetSearchLoading(true)],
				this.flightService.search(action.payload)
					.pipe(
						mergeMap(payload => [
							new FlightActions.SetSearchLoading(false),
							new FlightActions.SetSearchResult({
								search: action.payload,
								data: payload && payload.data
							}),
							...payload && payload.data ? [
								new GtmUserDetails(true),
								new GtmImpressionFlight(),
								new GtmFlightsAvailable()
							] : []
						]),
						catchError(error => [
							new FlightActions.SetSearchLoading(false),
							new AppAddError(error)
						])
					)
			))
		));

	/* pointsAndCash feature Flag on SearchforPointsAndMonetary and SearchforPointonly Apply */
	searchForPointsAndMonetary$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.Search>(FlightActionTypes.SEARCH),
			filter((action) => (this.featureFlags && this.featureFlags.pointsAndCash) && action.payload.usePoints),
			tap(() => this.storage.setItem('gtmSearchTime', new Date().toLocaleTimeString('en-US', { hour12: false }), true)),
			mergeMap(action => concat(
				[new FlightActions.SetSearchLoading(true)],
				combineLatest([this.flightService.search(action.payload, false), this.flightService.search(action.payload, true)])
					.pipe(
						mergeMap(payload => {

							payload[1].data.trips.forEach((trip, index) => {
								trip.journeysAvailable.forEach((journey, jindex) => {
									const fares = {};
									Object.keys(journey.fares).forEach((fare) => {
										fares[fare] = { ...journey.fares[fare], pointCash: true };
									});
									payload[0].data.trips[index].journeysAvailable[jindex].pointCashFares = {
										...fares
									};
								});
							});
							return [
								new FlightActions.SetSearchLoading(false),
								new FlightActions.SetSearchResult({
									search: action.payload,
									data: payload && payload[0].data
								}),
								...payload && payload[0].data ? [
									new GtmUserDetails(true),
									new GtmImpressionFlight(),
									new GtmFlightsAvailable()
								] : []
							];
						}
						),
						catchError(error => [
							new FlightActions.SetSearchLoading(false),
							new AppAddError(error)
						])
					)
			))
		));

	setSearchResult$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.SetSearchResult>(FlightActionTypes.SET_SEARCH_RESULT),
			concatLatestFrom(() => [
				this.store.select(FlightSelectors.fareSelections),
				this.store.select(FlightSelectors.searchResult),
				this.store.select(FlightSelectors.isAwardBooking),
				this.store.select(FlightSelectors.pointCashSelection),
			]),
			mergeMap(([_, fareSelections, searchResults, isAwardBooking, pointCashSelection]) => {
				const selectedFares = Object.values(fareSelections);
				const selectAction = [];

				selectedFares.forEach(selectedFare => {
					if (selectedFare) {
						const trips = searchResults.data.trips;
						const tripThatIsSelected = trips && trips.find(t => t.destination === selectedFare.journey.designator.destination && t.origin === selectedFare.journey.designator.origin);
						const matchingJourneyToSelect = tripThatIsSelected && tripThatIsSelected.journeysAvailable.find(j => j.journeyKey === selectedFare.journey.journeyKey);
						const tripIndex = trips.indexOf(tripThatIsSelected);
						const isClubFareSelected = selectedFare.fare.isClubFare;
						let fare = matchingJourneyToSelect && matchingJourneyToSelect.fares && Object.values(matchingJourneyToSelect.fares).find(f => f.isClubFare === isClubFareSelected);
						if (isAwardBooking && pointCashSelection === 'Pc') {
							fare = matchingJourneyToSelect && matchingJourneyToSelect.pointCashFares && Object.values(matchingJourneyToSelect.pointCashFares).find(f => f.isClubFare === isClubFareSelected);
						}
						const journeyFare = {
							journey: matchingJourneyToSelect,
							fare
						};
						selectAction.push(new FlightActions.SetFareSelection({
							index: tripIndex,
							journeyFare
						}));
					}
				});

				return selectAction;
			})
		));


	lowFareSearch$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.LowFareSearch>(FlightActionTypes.LOW_FARE_SEARCH),
			mergeMap(action => concat(
				[new FlightActions.SetLowFareSearchLoading(true)],
				this.flightService.searchLowFare(action.payload)
					.pipe(
						mergeMap(payload => [
							new FlightActions.SetLowFareSearchLoading(false),
							new FlightActions.SetLowFareSearchResult({
								search: action.payload,
								data: payload && payload.data
							}),
							...action.next
						]),
						catchError(error => [
							new FlightActions.SetLowFareSearchLoading(false),
							new AppAddError(error)
						])
					)
			))
		));


	changeCurrency$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.ChangeUsePoints>(FlightActionTypes.CHANGE_USE_POINTS),
			concatLatestFrom(() => [
				this.store.select(FlightSelectors.lowFareSearchResult),
				this.store.select(FlightSelectors.searchResult),
				this.store.select(AvailabilitySelectors.searchInput)
			]),
			mergeMap(([action, lowFareSearchResult, searchResult, searchInput]) => {
				let next: Action[] = [];
				if (lowFareSearchResult) {
					next = [
						new AvailabilitySetSearchInput({
							...searchInput,
							usePoints: action.payload
						}),
						new AppResetSession([
							new FlightActions.LowFareSearch({
								...lowFareSearchResult.search,
								usePoints: action.payload
							}, []),
							new FlightActions.Search({
								...searchResult.search,
								usePoints: action.payload
							})
						])
					];
				}
				if (action.shouldClearFareSelection) {
					next.push(new FlightActions.ClearFareSelections());
				}

				return next;
			})
		));

	getEarlyFlightOk$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.GetEarlyFlightOk>(FlightActionTypes.GET_EARLY_FLIGHT_OK),
			concatLatestFrom(() => [this.store.select(FlightSelectors.fareSelections)]),
			switchMap(([action, fareSelections]) => {
				const earlyFareSelection = fareSelections && Object.values(fareSelections).find(f => f.journey.isEarly);

				if (earlyFareSelection) {
					const initialState = {
						flightNumber: earlyFareSelection.journey.segments[0].identifier.identifier,
						departDate: earlyFareSelection.journey.designator.departure
					};
					const earlyFlightModal: EarlyFlightModalComponent = this.modalService.open(EarlyFlightModalComponent, { initialState }).componentInstance;
					return earlyFlightModal.response.pipe(
						take(1),
						mergeMap(response => response && action.next)
					);
				}

				return action.next;
			})
		));


	sellTrip$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.SellTrip>(FlightActionTypes.SELL_TRIP),
			concatLatestFrom(() => [
				this.store.select(FlightSelectors.fareSelections),
				this.store.select(AvailabilitySelectors.searchInputWithActualAdultCount),
				this.store.select(FlightSelectors.isAwardBooking),
				this.store.select(FlightSelectors.pointCashSelection)
			]),
			mergeMap(([action, fareSelections, searchInput, isAwardBooking, pointCashSelection]) => concat(
				of(new AppClearErrors()),
				this.flightService.sellTrip(fareSelections, searchInput.flightSearchInput.passengers, searchInput.flightSearchInput.promoCode, isAwardBooking, pointCashSelection)
					.pipe(
						switchMap((sellResponse) => {
							let outerNextActions: Action[];
							const nextActions = [new BookingActions.GetConfiguration(), new GetPointBaseMultipliers(), new FlightActions.Navigate(action.type)] as Action[];

							if (action.payload && action.payload.addClubMembership) {
								outerNextActions = [new BookingActions.AddClubMembership(undefined, nextActions)];
							} else {
								outerNextActions = nextActions;
							}

							return [
								new BookingActions.SetData(sellResponse && sellResponse.data),
								new SsrLoadAvailability(),
								...outerNextActions
							];
						}),
						catchError(error => of(new AppAddError(error)))
					)
			))
		));


	modifySellTrip$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.ModifySellTrip>(FlightActionTypes.MODIFY_SELL_TRIP),
			concatLatestFrom(() => [
				this.store.select(FlightSelectors.fareSelections),
				this.store.select(AvailabilitySelectors.searchInputWithActualAdultCount),
				this.store.select(FlightSelectors.isAwardBooking),
				this.store.select(FlightSelectors.pointCashSelection),
				this.store.select(BookingSelectors.distinctSelectedBundleCodes),
			]),
			mergeMap(([action, fareSelections, searchInput, isAwardBooking, pointCashSelection, distinctSelectedBundleCodes]) => concat(
				of(new AppClearErrors()),
				this.flightService.modifySellTrip(fareSelections, searchInput.flightSearchInput.passengers, searchInput.originalJourneyKeys, isAwardBooking, pointCashSelection)
					.pipe(
						switchMap((sellResponse) => {
							let ssrLoadAvailabilityNext: Action[];

							if (action.payload && (action.payload.signup || action.payload.enrollInClub)) {
								ssrLoadAvailabilityNext = [
									new BookingActions.AddClubMembership(action.payload.signup, [
										new BookingActions.GetConfiguration(),
										new BookingActions.GetData(),
										new FlightActions.Navigate(action.type)
									])
								];
							} else {
								ssrLoadAvailabilityNext = [
									new BookingActions.GetConfiguration(),
									new FlightActions.Navigate(action.type)
								];
							}

							let setData;
							if (sellResponse) {
								setData = sellResponse.data.newBooking;
								setData['seatRemappingNeeded'] = sellResponse.data.seatRemappingNeeded;
							}

							return [
								new BookingActions.SetData(setData),
								new SsrLoadAvailability(ssrLoadAvailabilityNext),
								...(distinctSelectedBundleCodes.length ? [new BundleManageGetPricing({ onSuccess: [] })] : [])
							];

						}),
						catchError(error => of(new AppAddError(error)))
					)
			))
		));

	upsellClubAndSellTrip$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.UpsellClubAndSellTrip>(FlightActionTypes.UPSELL_CLUB_AND_SELL_TRIP),
			concatLatestFrom(() => [
				this.store.select(authLoggedInState),
				this.store.select(UserSelectors.isClubMember),
				this.store.select(routerCurrentFlowState)
			]),
			mergeMap(([_, isLoggedIn, isClub, flow]) => {
				if (!isClub && !isLoggedIn && flow !== 'book') {
					const clubUpsellModal: ClubUpsellModalComponent = this.modalService.open(ClubUpsellModalComponent).componentInstance;
					return clubUpsellModal.response.pipe(
						take(1),
						mergeMap((response: ClubUpsellResponse): Action[] => !response ? [] :
							(response.password || response.loggedInPersonOnBooking)
								? [new FlightActions.SelectClubFaresAndSellTrip({ signup: response.password, enrollInClub: !response.loggedInAsClub })]
								: [new FlightActions.SelectStandardFaresAndSellTrip()])
					);
				} else if (!isClub && isLoggedIn && flow !== 'book') {
					return [new FlightActions.SelectClubFaresAndSellTrip({ signup: '', enrollInClub: true })];
				}

				return [new FlightActions.SelectClubFaresAndSellTrip()];
			})
		));


	selectStandardFaresAndSellTrip$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType(FlightActionTypes.SELECT_STANDARD_FARES_AND_SELL_TRIP),
			concatLatestFrom(() => [
				this.store.select(routerCurrentFlowState)
			]),
			map(([_, flow]) => {
				if (flow === 'book') {
					return new FlightActions.GetEarlyFlightOk([
						new AppResetSession([
							new FlightActions.SelectStandardFares(),
							new FlightActions.SellTrip()
						])
					]);
				}

				return new FlightActions.GetEarlyFlightOk([
					new FlightActions.SelectStandardFares(),
					new FlightActions.ModifySellTrip()
				]);
			})
		));

	selectClubFaresAndSellTrip$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.SelectClubFaresAndSellTrip>(FlightActionTypes.SELECT_CLUB_FARES_AND_SELL_TRIP),
			concatLatestFrom(() =>
			[
				this.store.select(routerCurrentFlowState),
				this.store.select(UserSelectors.isClubMember)
			]),
			map(([action, flow, userIsClub]) => {
				if (flow === 'book') {
					const actionCall = [new FlightActions.SelectClubFares(), new FlightActions.SellTrip({ addClubMembership: !userIsClub })];

					return new FlightActions.GetEarlyFlightOk([
						new AppResetSession(actionCall)
					]);
				}
				const actionsCall = [new FlightActions.SelectClubFares(), new FlightActions.ModifySellTrip({ signup: action.payload && action.payload.signup, enrollInClub: action.payload && action.payload.enrollInClub })];
				return new FlightActions.GetEarlyFlightOk(actionsCall);
			})
		));


	checkForSufficientPoints$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.CheckForSufficientPointsAndSellTrip>(FlightActionTypes.CHECK_FOR_SUFFICIENT_POINTS_AND_SELL_TRIP),
			concatLatestFrom(() => [
				this.store.select(UserSelectors.user),
				this.store.select(FlightSelectors.searchResult),
				this.store.select(FlightSelectors.fareSelections),
				this.store.select(FlightSelectors.loyaltyPointsTotal),
				this.store.select(FlightSelectors.loylatyPointsClubSavingTotal),
				this.store.select(FlightSelectors.pointsCashLoyaltyPointsTotal),
				this.store.select(FlightSelectors.pointCashSelection),
				this.store.select(AvailabilitySelectors.passengersSeatInputCount),
				this.store.select(routerCurrentFlowState),
				this.store.select(FlightSelectors.pointsCashLoyaltyPointsClubSavingTotal)
			]),
			mergeMap(([action, user, searchResult, fareSelected, loyaltyPointsTotal, loyaltyFareClubTotal, pointsCashLoyaltyPointsTotal, pointCashSelection, seatCount, flow, pointsCashLoyaltyPointsClubSavingTotal]) => {
				const userPointBalance = user && user.programs.filter(p => p.programCode === 'NK').reduce((totalPointBalance, program) => totalPointBalance += program.pointBalance, 0);
				const loyaltyPointsTotals = pointCashSelection === 'Pc' ? action.payload.enrollInClub ? (pointsCashLoyaltyPointsTotal * seatCount) - pointsCashLoyaltyPointsClubSavingTotal : (pointsCashLoyaltyPointsTotal * seatCount) : action.payload.enrollInClub ? (loyaltyPointsTotal * seatCount) - loyaltyFareClubTotal : (loyaltyPointsTotal * seatCount);
				const points = loyaltyPointsTotals;

				let continueFlowAction: Action[] = action.payload && action.payload.enrollInClub ?
					[new FlightActions.UpsellClubAndSellTrip()]
					: [new FlightActions.GetEarlyFlightOk([new FlightActions.ModifySellTrip()])];

				if (flow === 'book') {
					if (action.payload && action.payload.enrollInClub) {
						continueFlowAction = [new FlightActions.UpsellClubAndSellTrip()];
					} else {
						continueFlowAction = [
							new FlightActions.GetEarlyFlightOk([
								new AppResetSession(
									new FlightActions.SellTrip()
								)
							])
						];
					}
				}

				if (points > userPointBalance && !!user) {
					const insufficientPointsModal: InsufficientPointsModalComponent = this.modalService.open(InsufficientPointsModalComponent, {
						windowClass: 'modal-md-loyalty',
						initialState: {
							// TODO enrollInClub is coming as true for existing club member, this needs to be refactored to have a seperate way to know if they picked club loyalty fares
							loyaltyTotal: loyaltyPointsTotals,
							userLoyaltyPointsBalance: userPointBalance,
							isPointPlusCash: pointCashSelection === 'Pc',
							isChangeFlight: !((pointsCashLoyaltyPointsTotal * seatCount) <= userPointBalance && pointCashSelection === 'P')
						}
					}).componentInstance;
					return insufficientPointsModal.response.pipe(
						take(1),
						// loyalty changes for Insuffuicient Points
						mergeMap((response: any) => {
							if (response && response.updatedBalance) {
								const actions: Action[] = [];
								actions.push(new FlightActions.ChangeUsePoints(true, false));
								actions.push(new UserActions.UpdateAvailableMiles(response.updatedBalance));

								return actions;
							} else if (response && response.continue) {
								return continueFlowAction;
							} else if (response && response.pointCash && fareSelected) {

								const actions: Action[] = Object.values(fareSelected).map((journeyFare, i) => new FlightActions.SetFareSelection({ index: i, journeyFare: { ...journeyFare, fare: user.accountDetail.isClub && journeyFare.journey.pointCashClubFare || journeyFare.journey.pointCash } }));

								actions.push(new FlightActions.ValidateAndUpdateFareSelection(), new FlightActions.PointCashFare('Pc'));

								return actions;
							} else if (response && searchResult) {
								const actions: Action[] = searchResult.data.trips.map((__, index) => new FlightActions.SetFareSelection({
									index,
									journeyFare: null
								}));

								actions.push(new FlightActions.ChangeUsePoints(false, false));

								return actions;
							}

							return [new FlightActions.ClearFareAndViewSelections()];
						})
					);
				} else {
					return continueFlowAction;
				}
			})
		));

	selectLowestFares$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.SelectLowestFares>(FlightActionTypes.SELECT_LOWEST_FARES),
			concatLatestFrom(() => [
				this.store.select(FlightSelectors.searchResult),
				this.store.select(UserSelectors.isClubMember),
				this.store.select(UserSelectors.isCardHolder)
			]),
			mergeMap(([_, searchResult, userIsClub, userIsCardHolder]) => {
				if (!searchResult) {
					return [new FlightActions.SelectLowestFaresFailure()] as Action[];
				}

				const result = searchResult.search.criteria.map((__, index) => {
					const lowestFares: FaresModel = {};

					const journeys: JourneyModel[] = searchResult.data.trips[index].journeysAvailable.map(j => {
						if (Object.keys(j.fares).length) {
							const fares = []
								.concat(j.standardFare || [])
								.concat(userIsClub && j.clubFare || [])
								.concat(userIsCardHolder && j.cardHolderFare || []);

							const lowestFare = fares.reduce((lf: FareModel, f: FareModel) => !lf || f && f.fareAmount < lf.fareAmount ? f : lf, null);
							lowestFares[j.journeyKey] = lowestFare;

							return j;
						}
					});

					const lowestFareJourney = journeys.reduce((lfj: JourneyModel, j: JourneyModel) => {
						if (!lfj) {
							return j;
						}
						const fare1 = lowestFares[j.journeyKey];
						const fare2 = lowestFares[lfj.journeyKey];
						if (!fare2) {
							return j;
						}
						if (!fare1) {
							return lfj;
						}
						return fare1.fareAmount < fare2.fareAmount ? j : lfj;
					}, null);

					if (!lowestFareJourney || !lowestFareJourney.fares) {
						return null;
					}

					return new FlightActions.SetFareSelection({
						index,
						journeyFare: {
							journey: lowestFareJourney,
							fare: lowestFares[lowestFareJourney.journeyKey]
						}
					});
				}).filter(s => s);

				if (result.length === searchResult.data.trips.length) {
					return result;
				} else {
					return [new FlightActions.SelectLowestFaresFailure()] as Action[];
				}
			})
		));

	navigate$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.Navigate>(FlightActionTypes.NAVIGATE),
			concatLatestFrom(() => [
				this.store.select(routerCurrentFlowState),
				this.store.select(routerCurrentUrlNoParamsState),
				this.store.select(AvailabilitySelectors.searchInput),
				this.store.select(packageSearchResultState)
			]),
			switchMap(([action, flow, url, searchInput, result]) => {
				switch (action.payload) {
					case FlightActionTypes.COMBINATION_SEARCH:
					case PackageActionTypes.COMBINATION_SEARCH: {
						switch (searchInput.type) {
							case AvailabilitySearchType.flight:
								switch (flow) {
									case 'my-trips':
									case 'check-in':
										return [
											new NavigationActions.SetNext(
												new NavigationActions.FromModifyFlight.UpsellBags()
											),
											new NavigationActions.Navigate([flow, 'flights'])
										] as Action[];
									default:
										if (url !== '/book/flights') {
											return [new NavigationActions.Navigate(['book', 'flights'])];
										}
										return [];
								}

							case AvailabilitySearchType.package:
								switch (searchInput.subType) {
									case AvailabilitySearchSubType.flightCar:
										if (result) {
											if (result.data.Vehicles.length === 0) {
												return [new NavigationActions.Navigate(['book', 'flights'])];
											}
										}
										return [new NavigationActions.Navigate(['book', 'flights-cars'])];
									case AvailabilitySearchSubType.flightHotel:
										if (result) {
											if (result.data.Hotels.length === 0) {
												return [new NavigationActions.Navigate(['book', 'flights'])];
											} else {
												return [new NavigationActions.Navigate(['book', 'flights-hotels'])];
											}
										}
										break;
									case AvailabilitySearchSubType.flightHotelCar:
										if (result) {
											if (result.data.Hotels.length === 0 && result.data.Vehicles.length === 0) {
												return [new NavigationActions.Navigate(['book', 'flights'])];
											}
										}
										return [new PackageNavigate()];
								}
						} break;
					}

					case FlightActionTypes.SELL_TRIP: {
						switch (searchInput.type) {
							case AvailabilitySearchType.package:
								if (!result) {
									return [new BundleShowOffer({ onSelect: [new BookingActions.GetData()] })];
								} else {
									return [new PackageNavigate()];
								}
							default:
								return [new BundleShowOffer({ onSelect: [new BookingActions.GetData()] })];
						}
						break;
					}
					case FlightActionTypes.MODIFY_SELL_TRIP: {
						return [new NavigationActions.GoNext()];
					}
				}
			})
		));

	navigateOnCompletion$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.NavigateOnCompletion>(FlightActionTypes.NAVIGATE_ON_COMPLETION),
			tap((action: FlightActions.NavigateOnCompletion) => {
				action.payload.event.pipe(take(1)).subscribe(() => {
					this.store.dispatch(new FlightActions.Navigate(action.payload.searchType));
				});
			})
		), { dispatch: false });

	showModifyFlightModal$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.ShowModifyFlightModal>(FlightActionTypes.SHOW_MODIFY_FLIGHT_MODAL),
			mergeMap(_ => {
				const modalConfig: ModalOptionsModel = {
					windowClass: 'modal-percent-l'
				};
				this.modalService.open(ModifyFlightModalComponent, modalConfig);
				return new Array<Action>(new NavigationActions.SetSubFlow(SubFlow.modifyFlight));
			})

		));


	flightAwardBookingRedemptionFees$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType<FlightActions.SetFareSelection>(FlightActionTypes.SET_FARE_SELECTION),
			concatLatestFrom(() =>
			[
				this.store.select(FlightSelectors.isAwardBooking),
				this.store.select(UserSelectors.user),
			]),
			filter(([{ payload }, usePoints, _user]) => {
				return payload.index === 0 && usePoints && payload.journeyFare && payload.journeyFare.journey !== undefined;
			}),
			switchMap(([{ payload }, _usePoints, user]) => {
				const loyalty = payload.journeyFare.fare.fareAmount === payload.journeyFare.journey.standardFare.fareAmount ? 'PointsOnly' : 'PointsAndMonetary';
				return this.flightService.getRedemptionFee(payload.journeyFare.journey.designator.departure, loyalty, ((user && user.accountDetail && user.accountDetail.programLevelCode) || '')).pipe(
					map((data) => new FlightActions.AwardBookingRedepmtionFees(data.data)), catchError(() => [new FlightActions.AwardBookingRedepmtionFees(0)]));
			})
		));

	setUser$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType(UserActionTypes.SET_USER),
			concatLatestFrom(() => [
				this.store.select(UserSelectors.user),
				this.store.select(FlightSelectors.fareSelections),
				this.store.select(FlightSelectors.isAwardBooking),
			]),
			filter(([_, user, fareSelections, usePoints]) => {
				return user && user.accountDetail && !user.accountDetail.smcRedemptionFeeWaiver && fareSelections[0] && fareSelections[0].fare && fareSelections[0].journey && usePoints;
			}),
			switchMap(([_, user, fareSelections, _usePoints]) => {
				const loyalty = fareSelections[0] && fareSelections[0].fare && fareSelections[0].fare.loyaltyPoints === fareSelections[0].journey.standardFare.loyaltyPoints ? 'PointsOnly' : 'PointsAndMonetary';
				return this.flightService.getRedemptionFee(fareSelections[0].journey.designator.departure, loyalty, user.accountDetail.programLevelCode).pipe(
					map((data) => new FlightActions.AwardBookingRedepmtionFees(data.data)),
					catchError(() => [new FlightActions.AwardBookingRedepmtionFees(0)]));
			})
		));

	setUserAwardBookingFlightSelection$: Observable<Action> = createEffect(() => this.actions$
		.pipe(
			ofType(UserActionTypes.SET_USER),
			concatLatestFrom(() => [
				this.store.select(UserSelectors.isClubMember),
				this.store.select(FlightSelectors.fareSelections),
				this.store.select(FlightSelectors.isAwardBooking),
				this.store.select(FlightSelectors.pointCashSelection)
			]),
			filter(([_, isClub, fareSelections, usePoints]) => {
				return usePoints && isClub && fareSelections && Object.keys(fareSelections).length !== 0;
			}),
			mergeMap(([_, _isClub, fareSelections, _usePoints, pointCashSelected]) => {
				const actions = Object.values(fareSelections).map((journeyFare, i) => {
					if (pointCashSelected === 'Pc') {
						return new FlightActions.SetFareSelection({ index: i, journeyFare: { ...journeyFare, fare: journeyFare.journey.pointCashClubFare || journeyFare.journey.pointCash } });
					}
					return new FlightActions.SetFareSelection({ index: i, journeyFare: { ...journeyFare, fare: journeyFare.journey.clubFare || journeyFare.journey.standardFare } });
				});
				return actions;
			})
		));
}
