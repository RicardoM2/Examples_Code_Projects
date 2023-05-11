import { createSelector } from '@ngrx/store';
import * as moment from 'moment';
import { flightFeatureState } from '../reducers';
import { JourneyFareModel, FlightSearchResultModel, JourneyModel, FaresModel, FareModel, LowFareDateMarketModel, LowestFareModel, FlightLowFareSearchResultModel, FlightLowFareSearchCriteriaModel } from '../../models';
import { AvailabilitySelectors } from './availability.selector';
import { isWithin24Hours } from '../../../shared/utilities/date.utility';
import { UserSelectors } from './user.selector';
import { BookingSelectors } from './booking.selector';



export namespace FlightSelectors {
	const searchResultRaw = createSelector(
		flightFeatureState,
		(state) => state.searchResult
	);

	const lowFareSearchResultRaw = createSelector(
		flightFeatureState,
		(state) => state.lowFareSearchResult
	);

	export const isAwardBooking = createSelector(
		searchResultRaw,
		BookingSelectors.awardBookingTotal,
		(sr, awardBookingTotal) => awardBookingTotal && awardBookingTotal > 0 || sr && sr.search && sr.search.usePoints
	);

	export const pointCashSelection = createSelector(
		flightFeatureState,
		(sr) => sr && sr.isPointCash || ''
	);

	export const awardBookingRedepmtionFees = createSelector(
		flightFeatureState,
		(sr) => sr && sr.redemptionFees || 0
	);

	export const searchResult = createSelector(
		searchResultRaw,
		(sr): FlightSearchResultModel => {
			if (!sr) {
				return sr;
			}

			const search = sr.search;

			if (!sr.data) {
				return {
					search,
					data: {
						trips: []
					}
				};
			}

			let { trips } = sr.data;
			const { ...data } = sr.data;

			search.criteria.forEach((c, i) => {
				if (!trips.find(t => t.origin === c.originStationCode && t.destination === c.destinationStationCode)) {
					trips = [
						...trips.slice(0, i),
						{
							origin: c.originStationCode,
							destination: c.destinationStationCode,
							journeysAvailable: []
						},
						...trips.slice(i)

					];
				}
			});

			return {
				search,
				data: {
					...data,
					trips: trips.map(trip => {
						const journeysAvailable: JourneyModel[] = trip.journeysAvailable ? trip.journeysAvailable.map(journey => {
							const reformatFares = (faresToReformat) => Object.keys(faresToReformat).reduce((journeyFares, fareKey) => {
								const fare = faresToReformat[fareKey];
								const { details, ...fareWithoutDetails } = fare;
								const passengerFare = details.passengerFares[0];

								journeyFares[fare.fareAvailabilityKey] = {
									...fareWithoutDetails,
									isClubFare: details.isClubFare,
									isCardHolderFare: details.isCardHolderFare,
									fareAmount: passengerFare.fareAmountDifference !== null && passengerFare.fareAmountDifference !== undefined ? passengerFare.fareAmountDifference : passengerFare.fareAmount,
									originalFareAmount: passengerFare.originalFareAmount,
									loyaltyPoints: passengerFare.loyaltyPoints,
									fareAmountDifference: passengerFare.fareAmountDifference,
									accrualTotalTax: passengerFare.accrualTotalTax,
									productClass: details.productClass,
									taxFeeSum: fare.details.passengerFares.reduce((pfSum, pf) => pfSum + pf.serviceCharges.reduce((scSum, sc) => sc.detail === 'TaxFeeSum' ? scSum + sc.amount : scSum, 0), 0)
								};

								return journeyFares;
							}, {});

							const fares: FaresModel = reformatFares(journey.fares);
							const pointCashFares: FaresModel = journey.pointCashFares && reformatFares(journey.pointCashFares);

							return {
								...journey,
								fares,
								pointCashFares,
								clubFare: fares && Object.values(fares).find((fare: FareModel) => fare.isClubFare),
								standardFare: fares && Object.values(fares).find((fare: FareModel) => !fare.isClubFare),
								pointCash: pointCashFares && Object.values(pointCashFares).find((fare: FareModel) => !fare.isClubFare),
								pointCashClubFare: pointCashFares && Object.values(pointCashFares).find((fare: FareModel) => fare.isClubFare),
								cardHolderFare: fares && Object.values(fares).find((fare: FareModel) => fare.isCardHolderFare),
								isNextDayArrival: journey.designator && moment(journey.designator.arrival).startOf('day') > moment(journey.designator.departure).startOf('day'),
								isEarly: journey.designator && moment(journey.designator.departure).hour() < 4
							};
						}) : [];

						let defaultJourney: JourneyModel;
						if (search.defaultJourneyKey) {
							defaultJourney = journeysAvailable.find((j: JourneyModel) => j.journeyKey === search.defaultJourneyKey);
						}

						return {
							...trip,
							journeysAvailable,
							defaultJourney
						};
					})
				}
			};
		}
	);

	export const lowFareSearchResult = createSelector(
		lowFareSearchResultRaw,
		(sr): FlightLowFareSearchResultModel => {
			if (!sr) {
				return sr;
			}

			const search = sr.search;

			if (!sr.data) {
				return {
					search,
					data: {
						markets: []
					}
				};
			}

			const { lowFareDateMarkets, ...data } = sr.data;
			return {
				search,
				data: {
					...data,
					// edge case for multi city search criteria being the same city pair or dates, need to use index of criteria to add tripIndex to LowFareDateMarketModel Results
					markets: search.criteria.map((c: FlightLowFareSearchCriteriaModel, i: number) => {
						const dates: moment.Moment[] = [];

						for (let date = moment(c.beginDate); date <= moment(c.endDate); date = date.clone().add(1, 'days')) {
							dates.push(date);
						}

						return dates.map((date: moment.Moment): LowFareDateMarketModel => {
							if (!date.isBefore(moment().startOf('day'))) {
								const market = lowFareDateMarkets.filter(m => m.destination === c.destinationStationCode && m.origin === c.originStationCode).find(m => moment(m.departureDate).isSame(date, 'day'));

								if (market) {
									let lowestFare: LowestFareModel;

									if (search.usePoints) {
										if (market.lowestFareAmount) {
											const { farePointAmount, ...lowestFareAmount } = market.lowestFareAmount;
											lowestFare = !lowestFareAmount ? undefined : { ...lowestFareAmount, fareAmount: farePointAmount };
										}
									} else {
										lowestFare = market.lowFares.reduce((result: LowestFareModel, fare) => {
											const passenger = fare.passengers.ADT || fare.passengers.CHD;

											if (!result || (passenger.fareAmount + passenger.taxesAndFeesAmount) < result.totalFareAmount) {
												result = {
													fareAmount: passenger.fareAmount,
													taxesAndFeesAmount: passenger.taxesAndFeesAmount,
													totalFareAmount: passenger.fareAmount + passenger.taxesAndFeesAmount,
													fareAmountDifference: passenger.fareAmountDifference || market.lowestFareAmount.fareAmountDifference  // remove OR condition  fareAmountDifference !==0 on lowfare object
												};
											}

											return result;
										}, undefined);
									}

									return {
										...market,
										lowestFare,
										tripIndex: i
									};
								}
							}

							return {
								origin: c.originStationCode,
								destination: c.destinationStationCode,
								departureDate: date.format('YYYY-MM-DD'),
								lowFares: [],
								tripIndex: i
							} as LowFareDateMarketModel;
						});
					}).reduce((all, markets) => all.concat(markets), [])
				}
			};
		}
	);

	export const fareSelections = createSelector(
		flightFeatureState,
		(state) => state.fareSelections
	);

	export const previousFareSelections = createSelector(
		flightFeatureState,
		(state) => state.previousFareSelections
	);

	export const searchLoading = createSelector(
		flightFeatureState,
		(state) => state.searchLoading
	);

	export const lowFareSearchLoading = createSelector(
		flightFeatureState,
		(state) => state.lowFareSearchLoading
	);

	export const standardFareTotal = createSelector(
		fareSelections,
		(fs) => Object.values(fs).reduce((total: number, journeyFare: JourneyFareModel) => {
			return total + (journeyFare && journeyFare.journey && journeyFare.journey.standardFare && (journeyFare.journey.standardFare.fareAmount || 0));
		}, 0)
	);

	export const pointCashFareSelectionTotal = createSelector(
		fareSelections,
		(fs) => Object.values(fs).reduce((total: number, journeyFare: JourneyFareModel) => {
			return total + (journeyFare && journeyFare.fare && journeyFare.fare.fareAmount || 0);
		}, 0)
	);

	export const loyaltyPointsSelectionTotal = createSelector(
		fareSelections,
		(fs) => Object.values(fs).reduce((total: number, journeyFare: JourneyFareModel) => {
			return total + (journeyFare && journeyFare.fare && journeyFare.fare.loyaltyPoints || 0);
		}, 0)
	);

	export const pointCashFareTotal = createSelector(
		fareSelections,
		UserSelectors.isClubMember,
		(fs, isClub) => Object.values(fs).reduce((total: number, journeyFare: JourneyFareModel) => {
			if (isClub && (journeyFare && journeyFare.journey && journeyFare.journey.pointCashClubFare)) {
				return total + (journeyFare && journeyFare.journey && journeyFare.journey.pointCashClubFare && journeyFare.journey.pointCashClubFare.fareAmount || 0);
			}
			return total + (journeyFare && journeyFare.journey && journeyFare.journey.pointCash && (journeyFare.journey.pointCash.fareAmount || 0));
		}, 0)
	);

	export const faresSelectionTotal = createSelector(
		fareSelections,
		(fs) => Object.values(fs).reduce((total: number, journeyFare: JourneyFareModel) => {
			return total + (journeyFare && journeyFare.fare && (journeyFare.fare.fareAmount || 0));
		}, 0)
	);

	export const clubSavings = createSelector(
		fareSelections,
		AvailabilitySelectors.passengersSeatInputCount,
		(fs, availPassengerCount) => {
			const result = Object.values(fs).reduce((savings: number, journeyFare: JourneyFareModel) => {
				if (journeyFare.journey.clubFare && journeyFare.journey.standardFare) {
					savings += journeyFare.journey.standardFare.fareAmount - journeyFare.journey.clubFare.fareAmount;
				}
				return savings;
			}, 0);
			return result * (availPassengerCount ? availPassengerCount : 1);
		}
	);

	export const loyaltyPointsTotal = createSelector(
		fareSelections,
		UserSelectors.isClubMember,
		(fs, isClub) => Object.values(fs).reduce((total: number, journeyFare: JourneyFareModel) => {
			if (isClub && (journeyFare && journeyFare.journey && journeyFare.journey.clubFare)) {
				return total + (journeyFare && journeyFare.journey && journeyFare.journey.clubFare && journeyFare.journey.clubFare.loyaltyPoints || 0);
			}
			return total + (journeyFare && journeyFare.journey && journeyFare.journey.standardFare && journeyFare.journey.standardFare.loyaltyPoints || 0);
		}, 0)
	);

	export const pointsCashLoyaltyPointsTotal = createSelector(
		fareSelections,
		UserSelectors.isClubMember,
		(fs, isClub) => Object.values(fs).reduce((total: number, journeyFare: JourneyFareModel) => {
			if (isClub && (journeyFare && journeyFare.journey && journeyFare.journey.pointCashClubFare)) {
				return total + (journeyFare && journeyFare.journey && journeyFare.journey.pointCashClubFare && journeyFare.journey.pointCashClubFare.loyaltyPoints || 0);
			}
			return total + (journeyFare && journeyFare.journey && journeyFare.journey.pointCash && journeyFare.journey.pointCash.loyaltyPoints || 0);
		}, 0)
	);

	export const pointsCashLoyaltyPointsClubSavingTotal = createSelector(
		fareSelections,
		AvailabilitySelectors.passengersSeatInputCount,
		UserSelectors.isClubMember,
		(fs, availPassengerCount, isClub) => {
			const result = Object.values(fs).reduce((savings: number, journeyFare: JourneyFareModel) => {
				if (!isClub && journeyFare.journey && journeyFare.journey.pointCashClubFare && journeyFare.journey.pointCash) {
					savings += journeyFare.journey.pointCash.loyaltyPoints - journeyFare.journey.pointCashClubFare.loyaltyPoints;
				}
				return savings;
			}, 0);
			return result * (availPassengerCount ? availPassengerCount : 1);
		}
	);

	export const pointsCashFareClubSavingTotal = createSelector(
		fareSelections,
		AvailabilitySelectors.passengersSeatInputCount,
		UserSelectors.isClubMember,
		(fs, availPassengerCount, isClub) => {
			const result = Object.values(fs).reduce((savings: number, journeyFare: JourneyFareModel) => {
				if (!isClub && journeyFare.journey && journeyFare.journey.pointCashClubFare && journeyFare.journey.pointCash) {
					savings += journeyFare.journey.pointCash.fareAmount - journeyFare.journey.pointCashClubFare.fareAmount;
				}
				return savings;
			}, 0);
			return result * (availPassengerCount ? availPassengerCount : 1);
		}
	);

	export const pointsCashFareSavingTotal = createSelector(
		fareSelections,
		AvailabilitySelectors.passengersSeatInputCount,
		UserSelectors.isClubMember,
		(fs, availPassengerCount) => {
			const result = Object.values(fs).reduce((savings: number, journeyFare: JourneyFareModel) => {
				if (journeyFare.journey && journeyFare.journey.pointCashClubFare && journeyFare.journey.pointCash) {
					savings += journeyFare.journey.pointCash.fareAmount - journeyFare.journey.pointCashClubFare.fareAmount;
				}
				return savings;
			}, 0);
			return result * (availPassengerCount ? availPassengerCount : 1);
		}
	);

	export const loylatyPointsClubSavingTotal = createSelector(
		fareSelections,
		AvailabilitySelectors.passengersSeatInputCount,
		UserSelectors.isClubMember,
		(fs, availPassengerCount, isClub) => {
			const result = Object.values(fs).reduce((savings: number, journeyFare: JourneyFareModel) => {
				if (!isClub && journeyFare.journey.clubFare && journeyFare.journey.standardFare) {
					savings += journeyFare.journey.standardFare.loyaltyPoints - journeyFare.journey.clubFare.loyaltyPoints;
				}
				return savings;
			}, 0);
			return result * (availPassengerCount ? availPassengerCount : 1);
		}
	);

	export const loyaltyPointsFsmcTotal = createSelector(
		fareSelections,
		(fs) => Object.values(fs).reduce((total: number, journeyFare: JourneyFareModel) => {
			if (journeyFare && journeyFare.journey) {
				if (journeyFare.journey.cardHolderFare) {
					return total + (journeyFare.journey.cardHolderFare && journeyFare.journey.cardHolderFare.loyaltyPoints || 0);
				} else {
					return total + (journeyFare.journey.standardFare && journeyFare.journey.standardFare.loyaltyPoints || 0);
				}
			}
		}, 0)
	);

	export const selectionIsClubFare = createSelector(
		fareSelections,
		(fs) => Object.values(fs).filter(selectedFare => selectedFare.fare.isClubFare).length > 0
	);

	export const allFareSelectionMade = createSelector(
		fareSelections,
		searchResult,
		(fs, sr) => Object.values(fs).filter(journeyFare => !!journeyFare).length === (sr && sr.data.trips.filter((_, i) => !sr.search.criteria[i].hideResult).length)
	);

	export const lowFareViewSelections = createSelector(
		flightFeatureState,
		(state) => state.lowFareViewSelections
	);

	export const fareSelectionWithin24Hours = createSelector(
		fareSelections,
		(fs) => {
			const selections = fs && fs && Object.values(fs);
			return selections && selections[0] && isWithin24Hours(selections[0].journey.designator.departure);
		}
	);

	export const flightPointsBreakdownTotal = createSelector(
		loyaltyPointsSelectionTotal,
		AvailabilitySelectors.passengersSeatInputCount,
		(pointsTotal,  seatCount) => {
			return  pointsTotal  * seatCount;
		}
	);

	export const flightBreakdownTotal = createSelector(
		isAwardBooking,
		faresSelectionTotal,
		pointCashSelection,
		standardFareTotal,
		pointCashFareSelectionTotal,
		awardBookingRedepmtionFees,
		AvailabilitySelectors.passengersSeatInputCount,
		(usePoints, fareTotal, selectedAwFareType, standardTotal, pointsCashFareTotal, redemptionFees, seatCount) => {
			return usePoints ? ((selectedAwFareType === '' || selectedAwFareType === 'P' ? standardTotal : pointsCashFareTotal) + redemptionFees || 0) * seatCount : fareTotal * seatCount;
		}
	);

	export const flightsSectionBreakdownTotals = createSelector(
		fareSelections,
		AvailabilitySelectors.passengersSeatInputCount,
		(selections , seatCount) => {
			const selectedfares = Object.values(selections);
			const total = selectedfares.map(f => {
				const fareTotal = f.fare.fareAmount;
				const pointsFareTotal = f.fare.loyaltyPoints;
				return {
					total: ((fareTotal) * seatCount) || 0,
					pointsTotal: (pointsFareTotal * seatCount) || 0,
					destination: f && f.journey && f.journey.designator && f.journey.designator.destination || '',
					origin: f && f.journey && f.journey.designator && f.journey.designator.origin || '',
				};
			});
			return total;
		}
	);

}
