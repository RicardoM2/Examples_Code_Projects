import { ComponentFixture, TestBed, fakeAsync, tick, waitForAsync } from '@angular/core/testing';
import { Component, DebugElement } from '@angular/core';
import { StoreModule, Store } from '@ngrx/store';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import {
	FlightActions, AppResetSession,
	AvailabilitySetSearchInput, AvailabilityGetInternationalOk, AvailabilityValidatePromoCode, AvailabilityValidatePassengers, AvailabilityValidateFlightSearchDates,
	AvailabilitySetInternationalOk, AuthShowLogin
} from '../../../../core/store/actions';
import { CoreState, reducers } from '../../../../core/store/reducers';
import { FlightsPageComponent } from './flights-page.component';
import { SharedTestingModule } from '../../../../testing';
import { FlightSearchModel, JourneyFareModel, FareModel, AvailabilitySearchInputModel, JourneyModel, JourneyFareChangeModel, LowFareViewChangeModel, FlightLowFareSearchModel } from '../../../../core/models';
import { By } from '@angular/platform-browser';

@Component({
	template: ''
})
class MockComponent { }

describe('FlightsPageComponent', () => {
	let component: FlightsPageComponent;
	let fixture: ComponentFixture<FlightsPageComponent>;
	let store: Store<CoreState>;
	let router: Router;
	let element: DebugElement;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [
				FlightsPageComponent,
				MockComponent
			],
			imports: [
				StoreModule.forRoot(reducers, {
					runtimeChecks: {
						strictStateImmutability: true,
						strictActionImmutability: true
					}
				}),
				FormsModule,
				SharedTestingModule,
				NoopAnimationsModule,
				StoreRouterConnectingModule.forRoot(),
				RouterTestingModule.withRoutes([
					{
						path: 'book/flights',
						component: MockComponent
					},
					{
						path: 'my-trips/flights',
						component: MockComponent
					}
				])
			]
		})
			.compileComponents();
			router = TestBed.inject(Router);
			store = TestBed.inject(Store);
			spyOn(store, 'dispatch').and.callThrough();
			spyOn(store, 'select').and.callThrough();

			fixture = TestBed.createComponent(FlightsPageComponent);
			component = fixture.componentInstance;
			element = fixture.debugElement;
			component.addedPoints = 1000;
			fixture.detectChanges();
	}));

	// beforeEach(() => {
	// 	router = TestBed.inject(Router);
	// 	store = TestBed.inject(Store);
	// 	spyOn(store, 'dispatch').and.callThrough();
	// 	spyOn(store, 'select').and.callThrough();

	// 	fixture = TestBed.createComponent(FlightsPageComponent);
	// 	component = fixture.componentInstance;
	// 	element = fixture.debugElement;
	// 	component.addedPoints = 1000;
	// 	fixture.detectChanges();
	// });

	it('is created', () => {
		expect(component).toBeTruthy();
	});

	it('handles search', () => {
		store.dispatch(new AvailabilitySetSearchInput({
			flightSearchInput: {
				criteria: [{}]
			}
		} as AvailabilitySearchInputModel));

		component.onSearch();
		expect(store.dispatch).toHaveBeenCalledWith(new AvailabilityValidateFlightSearchDates([
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
	});

	it('handles view change', () => {
		const change = {
			search: {
				criteria: [{
					originStationCode: 'test',
					destinationStationCode: 'test',
					beginDate: new Date(2018, 1, 1),
					endDate: new Date(2018, 1, 1)
				}]
			}
		} as LowFareViewChangeModel;

		component.onLowFareViewChange(change);
		expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.LowFareSearch(change.search, [
			new FlightActions.ChangeLowFareView(change)
		]));
	});

	it('handles low fare search change', () => {
		const search = {
			criteria: [{
				originStationCode: 'test',
				destinationStationCode: 'test',
				date: new Date(2018, 1, 1),
				selectedDate: new Date(2018, 1, 1)
			}]
		} as FlightLowFareSearchModel;

		component.onLowFareSearchChange(search);
		expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.LowFareSearch(search, []));
	});

	it('handles search change', () => {
		const search = {
			criteria: [{
				originStationCode: 'test',
				destinationStationCode: 'test',
				date: new Date(2018, 1, 1)
			}]
		} as FlightSearchModel;

		component.onSearchChange(search);
		expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.ValidateSeasonalService(search, [
			new FlightActions.Search(search)
		]));
	});

	it('handles result use points change', () => {
		component.onResultUsePointsChange(true);
		expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.ChangeUsePoints(true));
	});

	it('handles selected fare change', () => {
		const fare = {
			fareAvailabilityKey: 'test'
		} as FareModel;
		const journeyFare: JourneyFareModel = {
			journey: {
				journeyKey: 'test'
			} as JourneyModel,
			fare: fare
		};
		const change: JourneyFareChangeModel = {
			index: 1,
			journeyFare
		};

		component.onSelectedFareChange(change);
		expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.SetFareSelection(change));
	});

	it('should call onLoyaltyContinue with user', () => {
		component.onLoyaltyContinue(false, true);
		const actions = [new FlightActions.CheckForSufficientPointsAndSellTrip({ enrollInClub: false}), new FlightActions.SelectStandardFares()];
		expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.ValidateFareSelections(actions));
	});

	it('should call onLoyaltyContinue without user', () => {
		component.onLoyaltyContinue(false, false);
		expect(store.dispatch).toHaveBeenCalledWith(new AuthShowLogin());
	});

	it('handles international ok', () => {
		component.onInternationalOk();
		expect(store.dispatch).toHaveBeenCalledWith(new AvailabilitySetInternationalOk());
	});

	it('handles search use points change', () => {
		const input = {} as AvailabilitySearchInputModel;
		component.onFlightSearchInputChange(input);
		expect(store.dispatch).toHaveBeenCalledWith(new AvailabilitySetSearchInput(input));
	});

	it('should show points updated box', () => {
		const addMiles = element.query(By.css('.added-Miles'));
			expect(addMiles).toBeTruthy();
	});

	describe('it handles continue for ', () => {
		describe('book path -', () => {
			it('standard continue', fakeAsync(() => {
				router.navigateByUrl('book/flights');
				tick();
				component.onStandardContinue();
				expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.ValidateFareSelections([
					new FlightActions.SelectStandardFaresAndSellTrip()
				]));
			}));

			it('non loyalty club continue', fakeAsync(() => {
				router.navigateByUrl('book/flights');
				tick();
				component.onClubContinue();
				expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.ValidateFareSelections([
					new FlightActions.UpsellClubAndSellTrip()
				]));
			}));

			it('loyalty club continue', () => {
				component.onLoyaltyContinue(true, true);
				const actions = [new FlightActions.CheckForSufficientPointsAndSellTrip({ enrollInClub: true }), new FlightActions.SelectStandardFares()];
				expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.ValidateFareSelections(actions));
			});
		});

		describe('my-trips path -', () => {
			it('standard continue', fakeAsync(() => {
				router.navigateByUrl('my-trips/flights');
				tick();
				component.onStandardContinue();
				expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.ValidateFareSelections([
					new FlightActions.SelectStandardFaresAndSellTrip()
				]));
			}));

			it('non loyalty club continue', fakeAsync(() => {
				router.navigateByUrl('my-trips/flights');
				tick();
				component.onClubContinue();
				expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.ValidateFareSelections([
					new FlightActions.UpsellClubAndSellTrip()
				]));
			}));

			it('loyalty club continue', () => {
				component.onLoyaltyContinue(true, true);
				const actions = [new FlightActions.CheckForSufficientPointsAndSellTrip({ enrollInClub: true }), new FlightActions.SelectStandardFares()];
				expect(store.dispatch).toHaveBeenCalledWith(new FlightActions.ValidateFareSelections(actions));
			});
		});
	});
});
