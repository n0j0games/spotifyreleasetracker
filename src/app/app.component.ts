import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {HeaderComponent} from "./header/header.component";
import {AuthComponent} from "./auth/auth.component";
import {ReleaseListComponent} from "./release-list/release-list.component";
import {ErrorComponent} from "./error-modal/error.component";
import {ArtistManagementComponent} from "./release-list/artist-management/artist-management.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, AuthComponent, ReleaseListComponent, ErrorComponent, ArtistManagementComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {

}
