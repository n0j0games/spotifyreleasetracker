import { Component } from '@angular/core';
import {SettingsComponent} from "./settings/settings.component";
import {NgIf} from "@angular/common";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    SettingsComponent,
    NgIf
  ],
  templateUrl: './header.component.html'
})
export class HeaderComponent {

}
