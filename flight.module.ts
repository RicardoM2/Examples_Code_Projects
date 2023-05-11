import { NgModule, PLATFORM_ID } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';

import { SharedModule } from '../../shared';
import * as fromComponents from './components';

import { TranslateSync } from '../../core/services/translate-sync.service';
import { translateLoader } from '../../core/translate-loader';

// for AOT
export function createTranslateLoader(platformId: Object, http: HttpClient) {
	return translateLoader(platformId, http, ['flight']);
}

export const ROUTES: Routes = [
	{
		path: '',
		component: fromComponents.FlightsPageComponent
	}
];

@NgModule({
	imports: [
		RouterModule.forChild(ROUTES),
		SharedModule,
		TranslateModule.forChild({
			loader: {
				provide: TranslateLoader,
				useFactory: (createTranslateLoader),
				deps: [PLATFORM_ID, HttpClient]
			},
			isolate: true
		})
	],
	declarations: [...fromComponents.components],
	providers: [TranslateSync]
})
export class FlightModule {
	constructor(private translateSync: TranslateSync) {
		this.translateSync.sync();
	}
}
