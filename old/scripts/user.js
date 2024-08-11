/**
 * User class. Stores users settings and informations
 * @class
 * @param {Object} data - User data from Spotify API
 * @param {Object} pantry - Saved pantry Data
**/

//import PantryAPI from "./pantry.js"; 
//const pantry = new PantryAPI();

class User {
    constructor(data, pantry_data) {
        // Load user info which will not be saved;
        this.id = data.id;
        this.displayname = data.display_name;
        this.playlists = [];
        if (data.images.length > 0) {
            this.image = data.images[0].url;
        } else {
            this.image = "../images/profilepic.png";
        }

        // Load stored data
        /*if (usePantry && pantry_data !== null && pantry_data.artists !== null) {
            this.user_ = pantry_data;
            this.saveToLocalStorage(false);
            console.log("Logging in as", this.displayname, "via pantry data")
        } else { */
            const raw = localStorage.getItem("user_"+this.id);
            const oldartists_ = localStorage.getItem("artists"+this.id);
            if (raw === null && oldartists_ !== null) {
                console.log("Converting old format to new format")
                this.convertToNewFormat();
            } else if (raw === null) {
                console.log("Create new user")
                this.createUser(data);
            } else {
                try {
                    this.user_ = JSON.parse(raw);
                    if (this.user_.release_playlists === undefined) {
                        this.user_.release_playlists = [];
                    }
                    if (this.user_.sort_by === undefined) {
                        this.user_.sort_by = "release_date";
                    }
                    //this.saveToPantry();                
                    console.log("Logging in as", this.displayname)
                } catch (e) {
                    logger.error("Could not load user", e)
                }
            }
        /*}*/

    }

    createUser(data) {
        this.user_ = {
            "artists": null,
            "market": data.country,
            "timespan": 7,
            "advanced_filter" : false,
            "not_save_doubles" : false,
            "active_playlist": "your_library",
            "sort_by" : "release_date",
            "saved_playlists": [],
            "release_playlists" : []
        }
    }

    convertToNewFormat() {
        const artists_ = JSON.parse(localStorage.getItem("artists"+this.id));
        const market_ = localStorage.getItem("marketplace");
        const timespan_ = localStorage.getItem("timeSpan");
        const active_playlist_ = localStorage.getItem("active_playlist");
        this.user_ = {
            "artists": artists_,
            "market": market_,
            "timespan": timespan_,
            "advanced_filter" : false,
            "not_save_doubles" : false,
            "active_playlist": active_playlist_,
            "sort_by" : "release_date",
            "saved_playlists": [],
            "release_playlists" : [],
        }
        this.saveToLocalStorage();
        localStorage.removeItem("artists"+this.id);
        localStorage.removeItem("marketplace");
        localStorage.removeItem("timeSpan");
        localStorage.removeItem("active_playlist");
    }

    saveToLocalStorage(savePantry = true) {
        /*if (savePantry) {
            this.saveToPantry();
        }*/
        localStorage.setItem("user_"+this.id, JSON.stringify(this.user_));
    }

    /*saveToPantry() {
        console.log("Saved user to pantry");
        pantry.call("POST", this.id, null, console.error, "Could not save user to pantry", this.user_);
    }*/

    exportUser() {
        return this.user_;
    }

    importUser(user_) {
        this.user_ = user_;
        this.saveToLocalStorage();
    }

    get id() {
        if (this._id === undefined) {
            console.error("Requested user ID, but it was undefined")
        }
        return this._id;
    }

    set id(id) {
        this._id = id;
    }

    get artists() {
        for (let i in this.user_.artists) {
            this.user_.artists[i].added = true;
            this.user_.artists[i].active = true;
        }
        return this.user_.artists;
    }

    set artists(artists) {
        this.user_.artists = artists;
        this.saveToLocalStorage();
    }

    get release_playlists() {
        return this.user_.release_playlists;
    }

    set release_playlists(release_playlists) {
        this.user_.release_playlists = release_playlists;
        this.saveToLocalStorage();
    }

    get advanced_filter() {
        return this.user_.advanced_filter;
    }

    set advanced_filter(advanced_filter) {
        this.user_.advanced_filter = advanced_filter;
        this.saveToLocalStorage();
    }

    get not_save_doubles() {
        return this.user_.not_save_doubles;
    }

    set not_save_doubles(not_save_doubles) {
        this.user_.not_save_doubles = not_save_doubles;
        this.saveToLocalStorage();
    }

    get saved_playlists() {
        return this.user_.saved_playlists;
    }

    set saved_playlists(saved_playlists) {
        this.user_.saved_playlists = saved_playlists;
        this.saveToLocalStorage();
    }

    replaceSavedPlaylist(playlist) {
        for (let i in this.saved_playlists) {
            if (this.saved_playlists[i].name === playlist.name) {
                this.saved_playlists[i].items = playlist.items;
                break;
            }
        }
        this.saveToLocalStorage();
    }

    get market() {
        return this.user_.market;
    }

    set market(market) {
        this.user_.market = market;
        this.saveToLocalStorage();
    }

    get timespan() {
        return this.user_.timespan;
    }

    set timespan(timespan) {
        this.user_.timespan = timespan;
        this.saveToLocalStorage();
    }

    get playlists() {
        return this._playlists;
    }

    set playlists(playlists) {
        this._playlists = playlists;
    }

    get active_playlist() {
        return this.user_.active_playlist;
    }

    set active_playlist(active_playlist) {
        this.user_.active_playlist = active_playlist;
        this.saveToLocalStorage();
    }

    get sort_by() {
        return this.user_.sort_by;
    }

    set sort_by(sort_by) {
        this.user_.sort_by = sort_by;
        this.saveToLocalStorage();
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