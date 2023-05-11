import { FlightActionTypes, FlightAction } from '../actions/flight.action';
import { FareSelectionsModel, LowFareViewSelectionsModel, FlightSearchModel, FlightLowFareSearchModel } from '../../models';

export interface State {
	searchResult: { search: FlightSearchModel, data: any };
	lowFareSearchResult: { search: FlightLowFareSearchModel, data: any };
	fareSelections: FareSelectionsModel;
	previousFareSelections: FareSelectionsModel;
	lowFareViewSelections: LowFareViewSelectionsModel;
	searchLoading: number;
	lowFareSearchLoading: number;
	isPointCash: string;
	redemptionFees: number;
}

export const INITIAL_STATE: State = {
	searchResult: null,
	lowFareSearchResult: null,
	fareSelections: {},
	previousFareSelections: {},
	lowFareViewSelections: {},
	searchLoading: 0,
	lowFareSearchLoading: 0,
	isPointCash: '',
	redemptionFees: 0
};

export function reducer(state = INITIAL_STATE, action: FlightAction): State {
	switch (action.type) {
		case FlightActionTypes.SET_SEARCH_RESULT:
			return {
				...state,
				searchResult: action.payload
			};

		case FlightActionTypes.SET_LOW_FARE_SEARCH_RESULT:
			return {
				...state,
				lowFareSearchResult: action.payload
			};

		case FlightActionTypes.CLEAR_SEARCH_RESULTS:
			return {
				...state,
				searchResult: null,
				lowFareSearchResult: null,
				fareSelections: {},
				lowFareViewSelections: {},
				isPointCash: ''
			};

		case FlightActionTypes.CLEAR_FARE_AND_VIEW_SELECTIONS:
			return {
				...state,
				fareSelections: {},
				lowFareViewSelections: {},
				isPointCash: ''
			};

		case FlightActionTypes.CLEAR_FARE_SELECTIONS:
			return {
				...state,
				fareSelections: {},
				isPointCash: ''
			};

		case FlightActionTypes.SET_SEARCH_LOADING:
			return {
				...state,
				searchLoading: action.payload ? state.searchLoading + 1 : state.searchLoading - 1
			};

		case FlightActionTypes.SET_LOW_FARE_SEARCH_LOADING:
			return {
				...state,
				lowFareSearchLoading: action.payload ? state.lowFareSearchLoading + 1 : state.lowFareSearchLoading - 1
			};

		case FlightActionTypes.SET_FARE_SELECTION:

			const { [action.payload.index]: omit, ...fareSelectionsWithIndexOmitted } = state.fareSelections;

			return action.payload.journeyFare ?
				{
					...state,
					fareSelections: {
						...state.fareSelections,
						[action.payload.index]: action.payload.journeyFare
					},


					previousFareSelections: {
						...state.previousFareSelections,
						...state.fareSelections
					}
				} :
				{
					...state,
					fareSelections: {
						...fareSelectionsWithIndexOmitted
					},
					previousFareSelections: {
						...state.previousFareSelections,
						...state.fareSelections
					}
				};
				case FlightActionTypes.FARE_REDEMPTION_FEES:
					return {
						...state,
						redemptionFees: action.payload
					};
		case FlightActionTypes.CHANGE_LOW_FARE_VIEW:
			const selectionsObj = { [action.payload.index]: action.payload.view };
			state.searchResult && state.searchResult.data && state.lowFareSearchResult.search.criteria.forEach((_, i) => {
				selectionsObj[i] = action.payload.view;
			});

			return {
				...state,
				lowFareViewSelections: selectionsObj
			};

		case FlightActionTypes.SELECT_STANDARD_FARES:
			return {
				...state,
				fareSelections: Object.keys(state.fareSelections).reduce((result: FareSelectionsModel, key: string) => {
					result[key] = {
						...state.fareSelections[key],
						fare:  state.isPointCash === 'Pc' ?  state.fareSelections[key].journey.pointCash : state.fareSelections[key].journey.standardFare
					};
					return result;
				}, {})
			};

		case FlightActionTypes.SELECT_CLUB_FARES:
			return {
				...state,
				fareSelections: Object.keys(state.fareSelections).reduce((result: FareSelectionsModel, key: string) => {
					result[key] = {
						...state.fareSelections[key],
						fare: state.isPointCash === 'Pc' ? state.fareSelections[key].journey.pointCashClubFare || state.fareSelections[key].journey.pointCash : state.fareSelections[key].journey.clubFare || state.fareSelections[key].journey.standardFare					};
					return result;
				}, {})
			};
		case FlightActionTypes.FARE_POINT_CASH_FLIGHT:
		return {
			...state,
			isPointCash: action.payload

		};

		default:
			return state;
	}
}
