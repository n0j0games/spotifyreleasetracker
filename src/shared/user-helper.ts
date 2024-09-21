import {LoginData} from "./login-data.model";
import {User} from "./user.model";
import {ReleaseOrder} from "./release-order.enum";
import {Artist} from "./artist.model";
import {Playlist} from "./playlist.model";
import {SavedPlaylist} from "./saved-playlist.model";

const YOUR_LIBRARY = "your_library";

/**
 * Helper to manage login and User class
 * @param data User data from Spotify API
 */
export class UserHelper {

  private _id: string;
  private displayName: any;
  private _playlists: any[];
  private image: { url: string } | null;
  private user: User;
  private country: string;

  constructor(data : LoginData) {
    this._id = data.id;
    this.displayName = data.display_name;
    this._playlists = [];
    this.image = null;
    this.country = data.country;
    this.user = {
      artists: null,
      market: this.country,
      timespan: 7,
      advancedFilter: false,
      notSaveDoubles: false,
      activePlaylist: YOUR_LIBRARY,
      sorting: ReleaseOrder.RELEASE_DATE,
      savedPlaylists: [],
      releasePlaylists: []
    };
    if (data.images.length > 0) {
      this.image = data.images[0];
    }
    this.loadUserData();
  }

  private loadUserData() {
    const raw = localStorage.getItem('user_'+this._id);
    const oldArtists = localStorage.getItem("artists"+this._id);
    if (raw === null && oldArtists !== null) {
      // Converting from old format to new format
      this.convertToNewFormat();
      return;
    }
    if (raw === null) {
      return;
    }
    this.user = JSON.parse(raw);
    if (this.user.releasePlaylists === undefined || this.user.releasePlaylists === null) {
      this.user.releasePlaylists = [];
    }
    if (this.user.sorting === undefined || this.user.sorting === null) {
      this.user.sorting = ReleaseOrder.RELEASE_DATE;
    }
  }

  private convertToNewFormat () {
    const rawArtists_ = localStorage.getItem("artists"+this._id)
    const artists_ = rawArtists_ ? JSON.parse(rawArtists_) : null;
    const market_ = localStorage.getItem("marketplace");
    const timespan_ = localStorage.getItem("timeSpan");
    const active_playlist_ = localStorage.getItem("active_playlist");
    this.user = {
      artists: artists_,
      market: market_ ? market_ : this.country,
      timespan: timespan_ ? <number><unknown>timespan_ : 7,
      advancedFilter : false,
      notSaveDoubles : false,
      activePlaylist: active_playlist_,
      sorting : ReleaseOrder.RELEASE_DATE,
      savedPlaylists: [],
      releasePlaylists : [],
    }
    this.saveToLocalStorage();
    localStorage.removeItem("artists"+this._id);
    localStorage.removeItem("marketplace");
    localStorage.removeItem("timeSpan");
    localStorage.removeItem("active_playlist");
  }

  private saveToLocalStorage() {
    localStorage.setItem("user_"+this._id, JSON.stringify(this.user));
  }

  public exportUser() {
    return this.user;
  }

  public importUser(user_ : User) {
    this.user = user_;
    this.saveToLocalStorage();
  }

  get id(): string {
    return this._id;
  }

  set id(value: string) {
    this._id = value;
  }

  get artists() {
    if (this.user.artists === null) {
      return [];
    }
    for (let artist of this.user.artists) {
      artist.added = true;
      artist.active = true;
    }
    return this.user.artists;
  }

  set artists(artists : Artist[]) {
    this.user.artists = artists;
  }

  get releasePlaylists() : Playlist[] | undefined {
    return this.user.releasePlaylists;
  }

  set releasePlaylists(value: Playlist[]) {
    this.user.releasePlaylists = value;
    this.saveToLocalStorage();
  }

  get advancedFilter() : boolean {
    return this.user.advancedFilter;
  }

  set advancedFilter(value: boolean) {
    this.user.advancedFilter = value;
    this.saveToLocalStorage();
  }

  get notSaveDoubles() : boolean {
    return this.user.notSaveDoubles;
  }

  set notSaveDoubles(value : boolean) {
    this.user.notSaveDoubles = value;
    this.saveToLocalStorage();
  }

  get savedPlaylists() : SavedPlaylist[] | undefined {
    return this.user.savedPlaylists;
  }

  set savedPlaylists(value : SavedPlaylist[]) {
    this.user.savedPlaylists = value;
    this.saveToLocalStorage();
  }

  replaceSavedPlaylist(playlist : SavedPlaylist) {
    if (this.user.savedPlaylists === undefined) {
      console.error("Tried to replace playlists but user.savedPlaylists is undefined");
      return;
    }
    for (let savedPlaylist of this.user.savedPlaylists) {
      if (savedPlaylist.name === playlist.name) {
        savedPlaylist.items = playlist.items;
        break;
      }
    }
    this.saveToLocalStorage();
  }

  get market() {
    return this.user.market;
  }

  set market(market) {
    this.user.market = market;
    this.saveToLocalStorage();
  }

  get timespan() {
    return this.user.timespan;
  }

  set timespan(timespan) {
    this.user.timespan = timespan;
    this.saveToLocalStorage();
  }

  get playlists() {
    return this._playlists;
  }

  set playlists(playlists) {
    this._playlists = playlists;
  }

  get activePlaylist() : string | null | undefined {
    return this.user.activePlaylist;
  }

  set activePlaylist(activePlaylist : string) {
    this.user.activePlaylist = activePlaylist;
    this.saveToLocalStorage();
  }

  get sorting() : ReleaseOrder | undefined {
    return this.user.sorting;
  }

  set sorting(sorting : ReleaseOrder) {
    this.user.sorting = sorting;
    this.saveToLocalStorage();
  }

  public getProfile() {
    return {
      id : this.id,
      displayName: this.displayName,
      image : this.image
    };
  }

}
