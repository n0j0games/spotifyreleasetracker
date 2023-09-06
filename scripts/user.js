/**
 * User class. Stores users settings and informations
 * @class
 * @param {Object} data - User data from Spotify API
**/

class User {
    constructor(data) {
        this.displayname = data.display_name;
        this.id = data.id;
        this.market = localStorage.getItem("marketplace");
        this.timespan = localStorage.getItem("timeSpan");
        this.playlists = []
        this.artists = localStorage.getItem("artists"+this.id)
        this.active_playlist = localStorage.getItem("active_playlist");
        if (this.active_playlist === null) {
            this.active_playlist = "your_library";
        }
        if (this.market === null) {
            this.market = data.country;
        }
        this.image = data.images[0].url;
        if (this.image === null) {
            this.image = "../images/profilepic.png";
        }
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }

    get artists() {
        return this._artists;
    }

    set artists(artists) { 
        localStorage.setItem("artists"+this.id, artists)
        this._artists = artists;
    }

    get market() {
        return this._market;
    }

    set market(market) {
        localStorage.setItem("marketplace", market);
        this._market = market;
    }

    get timespan() {
        return this._timespan;
    }

    set timespan(timespan) {
        localStorage.setItem("timeSpan", timespan);
        this._timespan = timespan;
    }

    get playlists() {
        return this._playlists;
    }

    set playlists(playlists) {
        this._playlists = playlists;
    }

    get active_playlist() {
        return this._active_playlist;
    }

    set active_playlist(active_playlist) {
        localStorage.setItem("active_playlist", active_playlist);
        this._active_playlist = active_playlist;
    }

    getProfile() {
        return {
            id : this.id,
            displayname: this.displayname,
            image : this.image
        };
    }
}

export default User;