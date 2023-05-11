import { Action } from '@ngrx/store';
import { Observable } from 'rxjs';

import { FlightSearchModel, FlightLowFareSearchModel, LowFareViewChangeModel, JourneyFareChangeModel } from '../../models';

export enum FlightActionTypes {
	COMBINATION_SEARCH = '[flight] COMBINATION_SEARCH',
	VALIDATE_SEARCH_DATES = '[flight] VALIDATE_SEARCH_DATES',
	VALIDATE_SEASONAL_SERVICE = '[flight] VALIDATE_SEASONAL_SERVICE',
	VALIDATE_FARE_SELECTIONS = '[flight] VALIDATE_FARE_SELECTIONS',
	VALIDATE_AND_UPDTAE_FARE_SELECTION = '[flight] VALIDATE_AND_UPDATE_FARE_SELECTION',
	SEARCH = '[flight] SEARCH',
	LOW_FARE_SEARCH = '[flight] LOW_FARE_SEARCH',
	SET_SEARCH_RESULT = '[flight] SET_SEARCH_RESULT',
	SET_LOW_FARE_SEARCH_RESULT = '[flight] SET_LOW_FARE_SEARCH_RESULT',
	CLEAR_SEARCH_RESULTS = '[flight] CLEAR_SEARCH_RESULTS',
	CLEAR_FARE_AND_VIEW_SELECTIONS = '[flight] CLEAR FARE AND VIEW SELECTIONS',
	CLEAR_FARE_SELECTIONS = '[flight] CLEAR FARE SELECTIONS',
	SET_SEARCH_LOADING = '[flight] SET_SEARCH_LOADING',
	SET_LOW_FARE_SEARCH_LOADING = '[flight] SET_LOW_FARE_SEARCH_LOADING',
	SET_FARE_SELECTION = '[flight] SET_FARE_SELECTION',
	SELECT_STANDARD_FARES = '[flight] SELECT_STANDARD_FARES',
	SELECT_CLUB_FARES = '[flight] SELECT_CLUB_FARES',
	SELECT_LOWEST_FARES = '[flight] SELECT_LOWEST_FARES',
	SELECT_LOWEST_FARES_FAILURE = '[flight] SELECT_LOWEST_FARES_FAILURE',
	CHANGE_LOW_FARE_VIEW = '[flight] CHANGE_LOW_FARE_VIEW',
	CHANGE_USE_POINTS = '[flight] CHANGE_USE_POINTS',
	GET_EARLY_FLIGHT_OK = '[flight] GET_EARLY_FLIGHT_OK',
	SELL_TRIP = '[flight] SELL_TRIP',
	MODIFY_SELL_TRIP = '[flight] MODIFY_SELL_TRIP',
	UPSELL_CLUB_AND_SELL_TRIP = '[flight] UPSELL_CLUB_AND_SELL_TRIP',
	SELECT_STANDARD_FARES_AND_SELL_TRIP = '[flight] SELECT_STANDARD_FARES_AND_SELL_TRIP',
	SELECT_CLUB_FARES_AND_SELL_TRIP = '[flight] SELECT_CLUB_FARES_AND_SELL_TRIP',
	CHECK_FOR_SUFFICIENT_POINTS_AND_SELL_TRIP = '[flight] CHECK_FOR_SUFFICIENT_POINTS_AND_SELL_TRIP',
	NAVIGATE = '[flight] NAVIGATE',
	NAVIGATE_ON_COMPLETION = '[flight] NAVIGATE_ON_COMPLETION',
	SHOW_MODIFY_FLIGHT_MODAL = '[flight] SHOW_MODIFY_FLIGHT_MODAL',
	FARE_POINT_CASH_FLIGHT = '[flight] FARE_POINT_CASH_FLIGHT',
	FARE_REDEMPTION_FEES = '[flight] FARE_REDEMPTION_FEES',
}

export namespace FlightActions {
	export class CombinationSearch implements Action {
		readonly type = FlightActionTypes.COMBINATION_SEARCH;

		constructor(public next: Action[]) { }
	}

	export class ValidateSearchDates implements Action {
		readonly type = FlightActionTypes.VALIDATE_SEARCH_DATES;

		constructor(
			public payload: FlightSearchModel,
			public next: Action[]
		) { }
	}

	export class ValidateSeasonalService implements Action {
		readonly type = FlightActionTypes.VALIDATE_SEASONAL_SERVICE;

		constructor(
			public payload: FlightSearchModel,
			public next: Action[]
		) { }
	}

	export class ValidateFareSelections implements Action {
		readonly type = FlightActionTypes.VALIDATE_FARE_SELECTIONS;

		constructor(public next: Action[]) { }
	}
	export class ValidateAndUpdateFareSelection implements Action {
		readonly type = FlightActionTypes.VALIDATE_AND_UPDTAE_FARE_SELECTION;
	}

	export class Search implements Action {
		readonly type = FlightActionTypes.SEARCH;

		constructor(public payload: FlightSearchModel) { }
	}

	export class LowFareSearch implements Action {
		readonly type = FlightActionTypes.LOW_FARE_SEARCH;

		constructor(
			public payload: FlightLowFareSearchModel,
			public next: Action[]
		) { }
	}

	export class SetSearchResult implements Action {
		readonly type = FlightActionTypes.SET_SEARCH_RESULT;

		constructor(public payload: { search: FlightSearchModel, data: any }) { }
	}

	export class ClearFareAndViewSelections implements Action {
		readonly type = FlightActionTypes.CLEAR_FARE_AND_VIEW_SELECTIONS;
	}

	export class ClearFareSelections implements Action {
		readonly type = FlightActionTypes.CLEAR_FARE_SELECTIONS;
	}

	export class SetLowFareSearchResult implements Action {
		readonly type = FlightActionTypes.SET_LOW_FARE_SEARCH_RESULT;

		constructor(public payload: {
			search: FlightLowFareSearchModel,
			data: any
		}) { }
	}

	export class ClearSearchResults implements Action {
		readonly type = FlightActionTypes.CLEAR_SEARCH_RESULTS;
	}

	export class SetSearchLoading implements Action {
		readonly type = FlightActionTypes.SET_SEARCH_LOADING;

		constructor(public payload: boolean) { }
	}

	export class SetLowFareSearchLoading implements Action {
		readonly type = FlightActionTypes.SET_LOW_FARE_SEARCH_LOADING;

		constructor(public payload: boolean) { }
	}

	export class SetFareSelection implements Action {
		readonly type = FlightActionTypes.SET_FARE_SELECTION;

		constructor(public payload: JourneyFareChangeModel) { }
	}

	export class SelectStandardFares implements Action {
		readonly type = FlightActionTypes.SELECT_STANDARD_FARES;
	}

	export class SelectClubFares implements Action {
		readonly type = FlightActionTypes.SELECT_CLUB_FARES;
	}

	export class SelectLowestFares implements Action {
		readonly type = FlightActionTypes.SELECT_LOWEST_FARES;
	}

	export class SelectLowestFaresFailure implements Action {
		readonly type = FlightActionTypes.SELECT_LOWEST_FARES_FAILURE;
	}

	export class ChangeLowFareView implements Action {
		readonly type = FlightActionTypes.CHANGE_LOW_FARE_VIEW;

		constructor(public payload: LowFareViewChangeModel) { }
	}

	export class ChangeUsePoints implements Action {
		readonly type = FlightActionTypes.CHANGE_USE_POINTS;

		constructor(public payload: boolean , public shouldClearFareSelection: boolean = true) { }
	}

	export class GetEarlyFlightOk implements Action {
		readonly type = FlightActionTypes.GET_EARLY_FLIGHT_OK;

		constructor(public next: Action[]) { }
	}

	export class SellTrip implements Action {
		readonly type = FlightActionTypes.SELL_TRIP;

		constructor(public payload?: {
			addClubMembership: boolean
		}) { }
	}

	export class ModifySellTrip implements Action {
		readonly type = FlightActionTypes.MODIFY_SELL_TRIP;

		constructor(public payload?: {
			signup: string,
			enrollInClub?: boolean
		}) { }
	}

	export class UpsellClubAndSellTrip implements Action {
		readonly type = FlightActionTypes.UPSELL_CLUB_AND_SELL_TRIP;
	}

	export class SelectStandardFaresAndSellTrip implements Action {
		readonly type = FlightActionTypes.SELECT_STANDARD_FARES_AND_SELL_TRIP;
	}

	export class SelectClubFaresAndSellTrip implements Action {
		readonly type = FlightActionTypes.SELECT_CLUB_FARES_AND_SELL_TRIP;

		constructor(public payload?: {
			signup: string,
			enrollInClub?: boolean
		}) { }
	}

	export class CheckForSufficientPointsAndSellTrip implements Action {
		readonly type = FlightActionTypes.CHECK_FOR_SUFFICIENT_POINTS_AND_SELL_TRIP;
		constructor(public payload?: {
			signup?: string,
			enrollInClub?: boolean
		}) { }
	}

	export class Navigate implements Action {
		readonly type = FlightActionTypes.NAVIGATE;

		constructor(public payload: string) { }
	}

	export class NavigateOnCompletion implements Action {
		readonly type = FlightActionTypes.NAVIGATE_ON_COMPLETION;

		constructor(public payload: {
			searchType: string,
			event: Observable<any>
		}) { }
	}

	export class ShowModifyFlightModal implements Action {
		readonly type = FlightActionTypes.SHOW_MODIFY_FLIGHT_MODAL;
	}

	export class PointCashFare implements Action {
		readonly type = FlightActionTypes.FARE_POINT_CASH_FLIGHT;
		constructor(public payload: string) { }
	}


	export class AwardBookingRedepmtionFees implements Action {
		readonly type = FlightActionTypes.FARE_REDEMPTION_FEES;
		constructor(public payload: number) { }
	}
}

export type FlightAction =
	FlightActions.CombinationSearch |
	FlightActions.ValidateSearchDates |
	FlightActions.ValidateSeasonalService |
	FlightActions.ValidateFareSelections |
	FlightActions.ValidateAndUpdateFareSelection |
	FlightActions.Search |
	FlightActions.LowFareSearch |
	FlightActions.SetSearchResult |
	FlightActions.SetLowFareSearchResult |
	FlightActions.ClearSearchResults |
	FlightActions.ClearFareAndViewSelections |
	FlightActions.ClearFareSelections |
	FlightActions.SetSearchLoading |
	FlightActions.SetLowFareSearchLoading |
	FlightActions.SetFareSelection |
	FlightActions.SelectStandardFares |
	FlightActions.SelectClubFares |
	FlightActions.SelectLowestFares |
	FlightActions.SelectLowestFaresFailure |
	FlightActions.ChangeLowFareView |
	FlightActions.ChangeUsePoints |
	FlightActions.GetEarlyFlightOk |
	FlightActions.SellTrip |
	FlightActions.ModifySellTrip |
	FlightActions.UpsellClubAndSellTrip |
	FlightActions.SelectStandardFaresAndSellTrip |
	FlightActions.SelectClubFaresAndSellTrip |
	FlightActions.Navigate |
	FlightActions.NavigateOnCompletion |
	FlightActions.ShowModifyFlightModal |
	FlightActions.PointCashFare |
	FlightActions.AwardBookingRedepmtionFees;
