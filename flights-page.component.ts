import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';
import { combineLatest, Observable, Subject } from 'rxjs';
import { Store } from '@ngrx/store';
import { take, takeUntil, filter, tap, map, withLatestFrom } from 'rxjs/operators';
import { CoreState } from '../../../../core/store/reducers';
import { environment } from '../../../../../environments/environment';
import {
	FlightActions, AppResetSession, AvailabilitySetSearchInput, AvailabilityGetInternationalOk, AvailabilityValidatePromoCode, AvailabilityValidatePassengers,
	AvailabilitySetInternationalOk, AvailabilityValidateFlightSearchDates, GtmAddToCartFlight, GtmRemoveFlight, GtmProductClickFlight, BookingActions,
	SeatLoadSeatMapsStateless, FlightInfoGetFlightPerformance, UserActions, AuthShowLogin
} from '../../../../core/store/actions';
import { AvailabilitySelectors, ResourceSelectors, FlightSelectors, BookingSelectors, bundleUpsellDisplayState, UserSelectors, routerCurrentFlowState, authLoggedInState, PointsSelectors, appGreySiteEnabledState } from '../../../../core/store/selectors';
import {
	WorldRegionModel, AvailabilitySearchInputModel, FlightSearchResultModel, FlightLowFareSearchResultModel, LowFareViewType, JourneyModel,
	FlightSearchModel, JourneyFareChangeModel, FareModel, LowFareViewChangeModel, FlightLowFareSearchModel, TripModel,
} from '../../../../core/models';
import { RefundabilityModalComponent, TaxesAndFeesModalComponent, SeatMapModalComponent, StopsModalComponent, FreeSpiritMastercardModalComponent } from '../../../../shared/components/modals';
import { ModalService } from '../../../../core/services';
import FeatureFlags from '../../../../../assets/config/feature-flags.json';
import * as moment from 'moment';
import { FeatureFlagType } from '../../../../core/models/feature-flag-type.model';

@Component({
	selector: 'app-flights-page',
	templateUrl: './flights-page.component.html',
	styleUrls: ['./flights-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlightsPageComponent implements OnInit, OnDestroy {
	private isDestroyed$ = new Subject();

	booking$ = this.store.select(BookingSelectors.booking);
	bookingHasFreeMove$ = this.store.select(BookingSelectors.hasFreeMove);
	stations$ = this.store.select(ResourceSelectors.stations);
	worldRegions$: Observable<WorldRegionModel> = this.store.select(ResourceSelectors.worldRegions);
	searchInput$ = this.store.select(AvailabilitySelectors.searchInput);
	standardFareTotal$ = this.store.select(FlightSelectors.standardFareTotal);
	loyaltyPointsTotal$ = this.store.select(FlightSelectors.loyaltyPointsTotal);
	clubSavings$ = this.store.select(FlightSelectors.clubSavings);
	allFareSelectionsMade$ = this.store.select(FlightSelectors.allFareSelectionMade);
	viewSelections$ = this.store.select(FlightSelectors.lowFareViewSelections);
	showOriginIsInternational$ = this.store.select(AvailabilitySelectors.showOriginIsInternational);
	showDestinationIsInternational$ = this.store.select(AvailabilitySelectors.showDestinationIsInternational);
	// todo rename bundleUpsellDisplay, name is completely off
	bundleUpsellDisplay$ = this.store.select(bundleUpsellDisplayState);
	iropAdvisoryData$ = this.store.select(BookingSelectors.iropAdvisoryData);
	bookingIsClub$ = this.store.select(BookingSelectors.isClub);
	userIsClub$ = this.store.select(UserSelectors.isClubMember);
	userIsCardHolder$ = this.store.select(UserSelectors.isCardHolder);
	fareSelectionTotal$ = this.store.select(FlightSelectors.faresSelectionTotal);
	flightBreakdownTotal$ = this.store.select(FlightSelectors.flightBreakdownTotal);
	flightPointsBreakdownTotal$ = this.store.select(FlightSelectors.flightPointsBreakdownTotal);
	fareSelections$ = this.store.select(FlightSelectors.fareSelections);
	flightsSectionBreakdownTotals$ = this.store.select(FlightSelectors.flightsSectionBreakdownTotals);
	seatCount$ = this.store.select(AvailabilitySelectors.passengersSeatInputCount);
	flow$ = this.store.select(routerCurrentFlowState);
	searchLoading$ = this.store.select(FlightSelectors.searchLoading);
	lowFareSearchLoading$ = this.store.select(FlightSelectors.lowFareSearchLoading);
	allOriginalJourneysWithin24HoursOfDeparture$ = this.store.select(BookingSelectors.allOriginalJourneysWithin24HoursOfDeparture);
	breakdownTotalPoints$ = this.store.select(BookingSelectors.breakdownTotalPoints);
	pointsEstimator$ = this.store.select(PointsSelectors.pointsEstimator);
	authLoggedInState$ = this.store.select(authLoggedInState);
	user$ = this.store.select(UserSelectors.user);
	awardBookingRedepmtionFees$ = this.store.select(FlightSelectors.awardBookingRedepmtionFees);
	pointsCashLoyaltyPointsTotal$ = this.store.select(FlightSelectors.pointsCashLoyaltyPointsTotal);
	loylatyPointsClubSavingTotal$ = this.store.select(FlightSelectors.loylatyPointsClubSavingTotal);
	pointsCashLoyaltyPointsClubSavingTotal$ = this.store.select(FlightSelectors.pointsCashLoyaltyPointsClubSavingTotal);
	pointCashFareTotal$ = this.store.select(FlightSelectors.pointCashFareTotal);
	pointsCashFareClubSavingTotal$ = this.store.select(FlightSelectors.pointsCashFareClubSavingTotal);
	tierId$ = this.store.select(UserSelectors.userTierID);
	isGreySiteEnabled$ = this.store.select(appGreySiteEnabledState);
	selectedAwFareType$ = this.store.select(FlightSelectors.pointCashSelection);
	anyFareSelectionIsClub$ = this.store.select(FlightSelectors.selectionIsClubFare);

	addedPoints: number;
	lowFareViewType = LowFareViewType;
	farePreSelections: { [index: string]: boolean } = {};
	newSearch = false;
	fareSelection: any;
	lowFareSearchResult: FlightLowFareSearchResultModel;
	searchResult: FlightSearchResultModel;
	isLoggedIn = false;
	taxesAndFeesForAwardBooking = 0;
	featureFlags: FeatureFlagType = FeatureFlags;
	cmsAssetsBaseUrl = environment.cmsAssetsBaseUrl;

	constructor(
		private store: Store<CoreState>,
		private modalService: ModalService,
		private location: Location,
	) { }

	ngOnInit() {
		// initial dummy data to display result placeholders
		this.store.select(AvailabilitySelectors.flightSearch).pipe(
			take(1)
		).subscribe(search => {
			this.lowFareSearchResult = {
				search: {
					criteria: search.criteria.map(() => ({}))
				} as FlightLowFareSearchModel,
				data: {
					markets: new Array(7).fill({})
				}
			};

			this.searchResult = {
				search,
				data: {
					trips: search.criteria.map(c => ({
						origin: c.originStationCode,
						destination: c.destinationStationCode,
						journeysAvailable: new Array(6).fill({
							designator: {
								origin: c.originStationCode,
								destination: c.destinationStationCode
							}
						})
					} as TripModel))
				}
			};
			this.getTaxAndFeeForAwardBooking();
		});

		this.store.select(UserSelectors.addedPoints).pipe(
			tap((points) => {
				if (points && this.searchResult && this.searchResult.search.usePoints) {
					this.addedPoints = points;
					this.store.dispatch(new UserActions.UpdateAvailableMiles(0));
				}
			}),
			takeUntil(this.isDestroyed$)
		).subscribe();

		this.store.select(FlightSelectors.lowFareSearchResult).pipe(
			filter(result => !!result),
			takeUntil(this.isDestroyed$)
		).subscribe(result => {
			this.newSearch = false;
			this.lowFareSearchResult = result;
			this.getTaxAndFeeForAwardBooking();
		});

		this.store.select(FlightSelectors.searchResult).pipe(
			filter(result => !!result),
			takeUntil(this.isDestroyed$)
		).subscribe(result => {
			this.newSearch = false;
			this.searchResult = result;
			this.getTaxAndFeeForAwardBooking();

			result.data.trips.forEach((trip, index) => {
				if (!this.farePreSelections[index] && trip.defaultJourney) {
					this.farePreSelections[index] = true;
					const change = {
						index,
						journeyFare: {
							journey: trip.defaultJourney,
							fare: Object.values(trip.defaultJourney.fares).reduce((lf: FareModel, f: FareModel) => !lf || f.fareAmount < lf.fareAmount ? f : lf, null)
						}
					};
					this.store.dispatch(new FlightActions.SetFareSelection(change));
				}
			});
		});

		this.authLoggedInState$.pipe(
			takeUntil(this.isDestroyed$)
		).subscribe(loggedIn => this.isLoggedIn = loggedIn);
	}

	onFlightSearchInputChange(input: AvailabilitySearchInputModel) {
		this.store.dispatch(new AvailabilitySetSearchInput(input));
	}

	onSearch() {
		this.store.dispatch(new AvailabilityValidateFlightSearchDates([
			new AvailabilityGetInternationalOk([
				new AvailabilityValidatePromoCode([
					new AvailabilityValidatePassengers([
						new AppResetSession(
							new FlightActions.CombinationSearch([]),
							{ excludedFlows: ['my-trips', 'check-in'] }
						)
					])
				])
			])
		]));
	}

	onLowFareViewChange(change: LowFareViewChangeModel) {
		this.store.dispatch(new FlightActions.LowFareSearch(change.search,
			[new FlightActions.ChangeLowFareView(change)]
		));
	}

	onLowFareSearchChange(search: FlightLowFareSearchModel) {
		this.store.dispatch(new FlightActions.LowFareSearch(search, []));
	}

	onSearchChange(search: FlightSearchModel) {
		this.store.dispatch(new FlightActions.ValidateSeasonalService(search,
			[new FlightActions.Search(search)]
		));
	}

	onResultUsePointsChange(usePoints: boolean) {
		this.store.dispatch(new FlightActions.ChangeUsePoints(usePoints));
		this.getTaxAndFeeForAwardBooking();
	}

	onSelectedFareChange(change: JourneyFareChangeModel) {
		combineLatest([
			this.store.select(UserSelectors.isCardHolder),
			this.store.select(FlightSelectors.fareSelections),
			this.store.select(FlightSelectors.isAwardBooking),
			this.store.select(routerCurrentFlowState)
		]).pipe(
			take(1)
		).subscribe(([userIsCardHolder, fareSelections, isAwardBooking, flow]) => {
			// todo cleanup mastercard modal is deprecated
			if (change.journeyFare && change.journeyFare.fare.isCardHolderFare && !userIsCardHolder) {
				this.modalService.open(FreeSpiritMastercardModalComponent);
				return;
			}

			if (!change.journeyFare) {
				this.store.dispatch(new GtmRemoveFlight(change.index));
				if (isAwardBooking && flow === 'book') {
					this.store.dispatch(new FlightActions.PointCashFare(''));
					Object.entries(fareSelections).forEach(([selectionKey]) => {
							const selKey = parseInt(selectionKey, 10);
							this.store.dispatch(new FlightActions.SetFareSelection({
								index: isNaN(selKey) ? null : selKey,
								journeyFare: null
							}));
					});
					return;
				}
			} else {
				if (isAwardBooking && flow === 'book') {
					this.store.dispatch(new FlightActions.PointCashFare(change.journeyFare.fare.pointCash ? 'Pc' : 'P'));
				}
			}

			this.store.dispatch(new FlightActions.SetFareSelection(change));
			this.store.dispatch(new FlightActions.ValidateAndUpdateFareSelection());
			if (change.index === 1 || change.index === 0) {
				if (change && change.journeyFare && change.journeyFare.fare.isClubFare) {
					// If fare changed to Savers Club, setFareSelection for all other trips
					Object.entries(fareSelections).forEach(([selectionKey, selectionValue]) => {
						if (selectionKey !== change.index.toString()) {
							const selKey = parseInt(selectionKey, 10);
							this.store.dispatch(new FlightActions.SetFareSelection({
								index: isNaN(selKey) ? null : selKey,
								journeyFare: {
									journey: selectionValue.journey,
									fare: change.journeyFare.fare.pointCash ? change.journeyFare.fare.isClubFare && selectionValue.journey.pointCashClubFare || selectionValue.journey.pointCash : selectionValue.journey.clubFare || selectionValue.journey.standardFare
								}
							}));
						}
					});
				}
			} else {
				if (change && change.journeyFare && (change.journeyFare.fare.isClubFare || (change.journeyFare.fare.isClubFare && change.journeyFare.fare.pointCash))) {
					this.store.dispatch(new FlightActions.SelectStandardFares());
				}
			}

			if (change.journeyFare) {
				this.store.dispatch(new GtmProductClickFlight(change.index));
				this.store.dispatch(new GtmAddToCartFlight(change.index));
			}
		});
	}

	onNonRefundableClick() {
		this.modalService.open(RefundabilityModalComponent);
	}

	onTaxesAndFeesClick() {
		this.modalService.open(TaxesAndFeesModalComponent);
	}

	onSeatAvailabilityClick(journey: JourneyModel) {
		this.store.dispatch(new SeatLoadSeatMapsStateless(journey.journeyKey));
		this.modalService.open(SeatMapModalComponent, { initialState: { journey } });
	}

	onStopsClick(journey: JourneyModel) {
		this.store.dispatch(new FlightInfoGetFlightPerformance(journey));
		this.modalService.open(StopsModalComponent, { initialState: { journey } });
	}

	onInternationalOk() {
		this.store.dispatch(new AvailabilitySetInternationalOk());
	}

	onStandardContinue() {
		this.store.dispatch(new GtmRemoveFlight(9));
		this.store.dispatch(new FlightActions.ValidateFareSelections(
			[new FlightActions.SelectStandardFaresAndSellTrip()]
		));
	}

	onClubContinue() {
		this.store.dispatch(new FlightActions.ValidateFareSelections(
			[new FlightActions.UpsellClubAndSellTrip()]
		));
	}

	onLoyaltyContinue(enrollInClub: boolean, isLoggedIn: boolean) {
		const dispatchSell = () => this.store.dispatch(new FlightActions.ValidateFareSelections(
			[new FlightActions.CheckForSufficientPointsAndSellTrip({ enrollInClub }),
			new FlightActions.SelectStandardFares()]
		));
		const dispatchClubSell = () => this.store.dispatch(new FlightActions.ValidateFareSelections(
			[new FlightActions.CheckForSufficientPointsAndSellTrip({ enrollInClub }),
			new FlightActions.SelectClubFares()]
		));
		if (!isLoggedIn) {
			this.store.select(UserSelectors.user).pipe(
				filter((user) => !!user),
				take(1),
				takeUntil(this.isDestroyed$),
				withLatestFrom(this.store.select(UserSelectors.isClubMember)),
				map(([_, isClub]) => {
					isClub ? dispatchClubSell() : dispatchSell();
				})
			).subscribe();
			this.store.dispatch(new AuthShowLogin());
		} else if (isLoggedIn) {
			this.store.select(UserSelectors.isClubMember).pipe(
				take(1),
				takeUntil(this.isDestroyed$),
				map((isClub) => {
					isClub ? dispatchClubSell() : dispatchSell();
				})
			).subscribe();
		} else {
			dispatchSell();
		}
	}

	onCancel() {
		this.store.dispatch(new BookingActions.GetData());
		this.location.back();
	}

	ngOnDestroy() {
		this.isDestroyed$.next();
	}

	getTaxAndFeeForAwardBooking() {
		this.taxesAndFeesForAwardBooking = 0;
		this.lowFareSearchResult && this.searchResult && this.lowFareSearchResult &&
			this.lowFareSearchResult.data && this.lowFareSearchResult.data.markets &&
			this.lowFareSearchResult.data.markets.forEach((market) => {
				if (market.lowestFare && market.lowestFare.taxesAndFeesAmount) {
					if (moment(market.departureDate).isSameOrAfter(moment(this.searchResult.search.criteria[0].date))) {
						if (market.lowestFare.taxesAndFeesAmount > this.taxesAndFeesForAwardBooking) {
							this.taxesAndFeesForAwardBooking = market.lowestFare.taxesAndFeesAmount;
						}
					}
				}
			});
	}

}
