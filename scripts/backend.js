/**
 * Main Backend. Handles the algorithm
 * @class
**/

import SpotifyAPI from "./api.js"; 
import keys from "../apikey.js";
import User from "./user.js";
import logger from "./logger.js";
import targetProxy from "./main.js";

const location_ = window.location.href.split("?")[0];
const api = new SpotifyAPI(keys.id, keys.secret, location_, window.showError);
let user = null;
let artists = [];
let current_playlist = null;
let filters = {
    album : false,
    single : false,
    feature : false
}

/*
    AUTH/LOGIN/LOGOUT
*/

function auth() {
    api.requestAuthorization( function(url) {window.location.href = url;} );
}

function handleRedirect() {
    api.handleRedirect( function() {window.history.pushState("", "", keys.uri);} );
}

function getAccessToken() {
    return api.access_token;
}

function getMarket() {
    return user.market;
}

function getTimespan() {
    return user.timespan;
}

function getActivePlaylist() {
    return user.active_playlist;
}

function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    location.reload();
}

/* Login Step 1: Request user Info */
function login(onLogin) {
    api.call("GET", "user_profile", null, onLogin,
        logger.error, "Could not load user profile") //Calls Step 2
}

/* Login Step 2: Called after successful login procedure */
function onLogin(response) {
    const data = JSON.parse(response);
    user = new User(data);

    api.call("GET", "playlists", null, playlistCallback, null, null) //Calls Step 3

    return user.getProfile();
}

/* Login Step 3 */
function playlistCallback(response) {
    let list = []
    const data = JSON.parse(response).items;
    for (let x in data) {
        list.push({name : data[x].name, id : data[x].id});
    }
    user.playlists = list;
    setCurrentPlaylist();
    loadArtists(); //Calls Step 4
    targetProxy.settings = {
        timespan : user.timespan,
        market : user.market,
        active_playlist : user.active_playlist,
        playlists : user.playlists
    };
}

/*
    ARTIST SECTION
*/

/* Login Step 4: Loading Artists, after Playlist is set*/
function loadArtists() {
    artists = user.artists;
    if (artists !== null) {
        console.log("Loaded artists")
        if (artists.length === 0) {
            targetProxy.albums = [];
            return;
        } else {
            artists = sortArtists(artists);
            targetProxy.artists = artists;
            refreshAlbums();
        }
    } else {
        console.log("Reset & reload artists");
        artists = [];
        api.call("GET", "followed_artists", null, artistCallback,
            logger.error, "Could not load artists" );
    }
}

/* Artist getter loop: Fetch artists from Spotify in batches of 50x */
let total = 0;
function artistCallback(response) {
    const data = JSON.parse(response);
    const items = data.artists.items;
    const limit = data.artists.limit;
    if (items.length !== 0) {
        if (total === 0) {
            total = data.artists.total;
            if (total < items.length) {
                console.warn("Total item count smaller than actual item count (Spotify Api Bug). Ignore this");
                total = items.length;
            }
            if (limit < total) {
                api.call("GET",
                    "followed_artists",
                    "&after="+items[items.length-1].id,
                    artistCallback,
                    logger.error,
                    "Could not load artists");
            }
        }
        
        // Update IDs of artists and add them to list
        for (let x in items) {
            const current = { id : items[x]["id"], name : items[x]["name"], image : items[x]["images"][0]["url"], active : true, following : true};
            let inList = false;
            for (let y in artists) { 
                if (artists[y].id === current.id) {
                    if (!artists[y].following) {
                        artists[y].following = true;
                    }
                    inList = true;
                    break;
                }
            }
            if (!inList) {
                artists.push(current);
            }
        }
    }
    saveArtists();
}

// Called from frontend, adds artist
function addArtist(searchq) {
    if (searchq === null || searchq === "") {
        return;
    } else if (searchq.startsWith("https")) {
        const split = searchq.split("?")[0].split("/");
        searchq = split[split.length-1];
    }
    api.call("GET", "artist_profile", searchq, onArtistFound, onArtistNotFound, searchq)
}

// Callback if artist found by ID
function onArtistFound(response) {
    const data = JSON.parse(response);
    const current = { id : data["id"], name : data["name"], image : data["images"][0]["url"], active : true, following : false};
    insertArtist(current);
}

// Callback if artist not found by ID, use search queue
function onArtistNotFound(status, searchq) { 
    if (status === 400) {
        api.call("GET", "search_artist", searchq, searchArtistCallback,
        logger.error, "Artist not found: Provided ID or URL is invalid. Artist name won't work, use URL instead (In Spotify click share and copy link to artist")
    } else {
        logger.error, "Unknown error"
    }
    
}

// Callback of Artist Search
function searchArtistCallback(response) {
    const data = JSON.parse(response);
    const item = data.artists.items[0];
    if (item.name == null) {
        console.warn("Artist not found");
        return;
    }
    const current = { id : item["id"], name : item["name"], image : item["images"][0]["url"], active : true, following : false};
    insertArtist(current);
}

// Insert artist
function insertArtist(current) {
    for (let x in artists) {
        if (artists[x].id === current.id) {
            return;
        }
    }
    artists.unshift(current);
    saveArtists();
}

// Save to localstorage, call proxy
function saveArtists() { 
    user.artists = artists;
    targetProxy.artists = artists;
    refreshAlbums();
}

// Hide artist, called from frontend
function hideArtist(nr) {
    artists[nr].active = !artists[nr].active;
    saveArtists();

}

// Remove artist, called from frontend
function removeArtist(nr) {
    for (let k in artists) {
        if (artists[nr].name === artists[k].name)
        artists.splice(nr, 1);
    }
    saveArtists();
}

// Sync artists with spotify, called from frontend
function syncArtists() {
    let temp = [];
    for (let k in artists) {
        if (!artists[k].following)
            temp.push(artists[k]);
    }
    artists = temp;
    total = 0;
    api.call("GET", "followed_artists", null, artistCallback,
            logger.error, "Could not load artists" );
}

function getActiveArtists() {
    let c = 0
    for (let x in artists) {
        if (artists[x].active) {
            c++;
        }
    }
    return c;
}

function sortArtists(temp) {
    temp.sort((a,b) => a.name.localeCompare(b.name));
    return temp;
}

/*
    ALBUM SECTION
*/

let results = []
let total_ = 0

// Refresh Albums, called after artists window closed and after first artist load
function refreshAlbums() {
    results = [];
    if (artists.size === 0) {
        targetProxy.albums = [];
        return
    }
    
    total_ = 0
    let active_artists = [];
    for (let x in artists) {
        if (artists[x].active) {
            total_++;
            active_artists.push(artists[x]);
        }
    }
    if (total_ === 0) {
        targetProxy.albums = [];
        return;
    }
    for (let x in active_artists) {
        const param = `${active_artists[x].id}/albums?limit=50&include_groups=album,single`
        api.call("GET", "artist", param, albumCallback, logger.error, "Could not load albums for artist")
    }
}

function albumCallback(response) {
    const items = JSON.parse(response).items;
    for (let x in items) {
        const item = items[x];
        let album = {
            title : item.name,            
            artist : item.artists[0].name,
            type : item.album_type,
            href : item.external_urls.spotify,
            image : item.images[0].url,
            artists_list : [],
            real_date : item.release_date,
            release_date : item.release_date,
            tracks : item.total_tracks,
            markets : item.available_markets,
            isfeature : true,
            show : true
        }
        for (const y in item.artists) {
            album.artists_list.push(item.artists[y].name);
        }
        let fromVariousArtists = false;
        for (const z in album.artists_list) {
            if (album.artists_list[z]["id"] === "0LyfQWJT6nXafLPZqxe9Of")
                fromVariousArtists = true;
        }
        for (const y in artists) {
            const temp = artists[y].name;
            if (album.artist.toLowerCase() === temp.toLowerCase()) {
                album.isfeature = false;
                break;
            }
        }
        const dateArray = album.release_date.split('-');
        album.release_date = new Date(dateArray[0], dateArray[1]-1, dateArray[2]);
        const intimespan = inTimeSpan(album.release_date);
        let duplicate = false;
        for (const y in results) {
            const title_ = results[y].album.title;
            const artist_ = results[y].album.artist;
            if (album.title === title_ && album.artist === artist_) {
                duplicate = true;
                break;
            }
        }
        if (intimespan  && !duplicate && !fromVariousArtists) {
            results.push({album});
        }
    }
    total_--;
    if (total_ === 0) {
        results = sortResults(results);
        filterAlbums();
    }
}

/* sort by date & main artist */
function sortResults(temp) {
    temp.sort((a,b) => a.album.artist.localeCompare(b.album.artist));
    temp.sort((a,b) => b.album.release_date.getTime() - a.album.release_date.getTime());
    return temp;
}

function inTimeSpan(date) {
    if (user.timespan === -1) {
        return true;
    }
    const now = new Date().getTime();
    let diff = Math.abs(now - date.getTime());
    diff = diff / (1000 * 60 * 60 * 24);
    return (diff <= user.timespan)
}

function toggleFilters(album, single, feature) {

    if (feature) {
        filters.feature = !filters.feature;
    } 
    if (album) {
        if (filters.album) {
            filters.album = false;
        } else {
            filters.album = true;
            filters.single = false;
        }
    } 
    if (single) {
        if (filters.single) {
            filters.single = false;
        } else {
            filters.single = true;
            filters.album = false;
        }
    }

    targetProxy.filters = filters;
    filterAlbums();
}

function filterAlbums() {
    for (let x in results) {
        if (filters.feature && results[x].album.isfeature) {
            results[x].album.show = false;
        } else if (filters.single && !(results[x].album.type === "single")) {
            results[x].album.show = false;
        } else if (filters.album && !(results[x].album.type === "album")) {
            results[x].album.show = false;
        } else {
            results[x].album.show = true;
        }
    }
    targetProxy.albums = results;
}

/*
    SETTINGS SECTION
*/

/* Change which current playlist is selected, called at start and if changed in settings */
function setCurrentPlaylist(){
    const saved_playlists = user.saved_playlists;
    if (user.saved_playlists === undefined) {
        user.saved_playlists = [];
    }
    for (let i in saved_playlists) {
        if (saved_playlists[i].name === user.active_playlist) {
            current_playlist = saved_playlists[i];
            break;
        }
    }
    if (current_playlist === null && user.active_playlist !== "none") {
        current_playlist = {"name" : user.active_playlist, "items" : []};
        let temp_ = user.saved_playlists;
        temp_.push(current_playlist);
        user.saved_playlists = temp_;
    }
}

/* called if settings change */
function saveSettings(time, market, active_playlist) {
    if (active_playlist != null) {
        user.active_playlist = active_playlist;
        setCurrentPlaylist();
    }
    if (time !== null) {
        if (isNaN(time) || time < 0 || time > 90) {
            logger.error("Could not save settings", "Input is not a number")
        } else {                    
            user.timespan = time;
        }
    }
    if (market !== null) {        
        user.market = market;
    }
    location.reload()
}

// Import data, called from frontend
function importData(value) {
    try {
        const data = JSON.parse(value);
        user.importUser(data);
        location.reload();
    } catch (e) {
        logger.error("Could not load user", "The entered data is not in JSON format")
    }
}

// Export data, called from frontend
async function exportData() {
    try {
        await navigator.clipboard.writeText(JSON.stringify((user.exportUser())));
        console.log('Content copied to clipboard');
        logger.log('Copied to clipbard', "You can now save the clipboard into a file and paste it back in the settings to restore your data later")
    } catch (err) {
        logger.error('Failed to copy data', err)
    }
}

// Reset artists, called from frontend
function deleteData() {
    localStorage.removeItem("user_"+user.id);
    logout();
}

/*
    SAVE SONG SECTION
*/

function songIsSaved(song) {
    return current_playlist.items.includes(song);
}

function saveSong(song) {
    logger.log("Coming soon...", "This feature is coming in near future!");
    const items = current_playlist.items;
    if (items.includes(song)) {
        console.warn("Wanted to save song even though its already saved");
        return;
    }
    current_playlist.items.push(song);
    if (current_playlist.items.length > 100) {
        console.warn("Only storing up to 100 Items in playlist, removing oldest");
        current_playlist.items.shift();
    }
    user.replaceSavedPlaylist(current_playlist);
    //TODO: Tatsächlich hier speichern, sobald das geht
    return;
    if (list === "none") {
        logger.log("Could not save song", "You have selected 'None' as your playlist, therefore the song could not be saved. Please select a playlist in the settings");
    } else if (list === "your_library") {
        api.call("PUT", "save_to_library", "?ids="+song, saveToLibraryCallback, logger.error, "Could not save song");
    }
}

function saveToLibraryCallback(response) {
    
}

export default {getActiveArtists,
    getTimespan,
    filterAlbums,
    getMarket,
    refreshAlbums,
    exportData,
    saveSettings,
    removeArtist,
    hideArtist,
    syncArtists,
    deleteData,
    importData,
    addArtist,
    loadArtists,
    auth,
    onLogin,
    handleRedirect,
    login,
    logout,
    getAccessToken,
    saveSong,
    getActivePlaylist,
    songIsSaved,
    toggleFilters
}