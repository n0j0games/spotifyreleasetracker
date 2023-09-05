/**
 * Main Backend. Handles the algorithm
 * @class
**/

import SpotifyAPI from "./api.js"; 
import keys from "../apikey.js";
import User from "./user.js";
import logger from "./logger.js";
import targetProxy from "./main.js";

const api = new SpotifyAPI(keys.id, keys.secret, keys.uri, window.showError);
let user = null;
let artists = [];

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

/* Login, request user Info */
function login(onLogin) {
    api.call("GET", "user_profile", null, onLogin,
        logger.error, "Could not load user profile")
}

/* Called after successful login procedure */
function onLogin(response) {
    const data = JSON.parse(response);
    user = new User(data);
    const time = localStorage.getItem("timeSpan");
    const market = localStorage.getItem("region");
    if (time !== null) {
        user.timespan = time;
    }
    if (market !== null) {
        user.market = market;
    }
    targetProxy.settings = { timespan : user.timespan, market : user.market };
    return user.getProfile();
}

function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    location.reload();
}

/*
    SETTINGS SECTION
*/

function saveSettings(time, market) {
    if (time !== null) {
        if (isNaN(time) || time < 0 || time > 90) {
            logger.error("Could not save settings", "Input is not a number")
        } else {
            localStorage.setItem("timeSpan", time);        
            user.timespan = time;
        }
    }
    if (market !== null) {
        localStorage.setItem("marketplace", market);
        user.market = market;
    }
    location.reload()
}

/*
    ARTIST SECTION
*/

/* Called from the frontend after login complete */
function loadArtists() {
    const artists_ = localStorage.getItem("artists"+user.id)
    if (artists_ !== null) {
        try {
            artists = JSON.parse(artists_);
        } catch (e) {
            logger.error("Could not load artists", e)
        }
        console.log("Loaded artists from local storage")
        if (artists.length === 0) {
            targetProxy.albums = [];
            return;
        } else {
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
    localStorage.setItem("artists"+user.id, JSON.stringify(artists));
    targetProxy.artists = artists;
    //refreshAlbums();
}

// Hide artist, called from frontend
function hideArtist(nr) {
    artists[nr].active = !artists[nr].active;
    saveArtists();

}

// Import artists, called from frontend
function importArtists(value) {
    localStorage.setItem("artists"+user.id, value);
    location.reload();
}

// Reset artists, called from frontend
function resetArtists() {
    localStorage.removeItem("artists"+user.id);
    location.reload();
}

// Remove artist, called from frontend
function removeArtist(nr) {
    for (let k in artists) {
        if (artists[nr].name === artists[k].name)
        artists.splice(nr, 1);
    }
    saveArtists();
}

async function exportArtists() {
    try {
        await navigator.clipboard.writeText(JSON.stringify((artists)));
        console.log('Content copied to clipboard');
        logger.log('Copied to clipbard', "")
    } catch (err) {
        logger.error('Failed to copy', err)
    }
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
        targetProxy.albums = results;
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

function filterAlbums(filters) {
    console.log("filters",filters)
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

export default {getActiveArtists,
    getTimespan,
    filterAlbums,
    getMarket,
    refreshAlbums,
    exportArtists,
    saveSettings,
    removeArtist,
    hideArtist,
    syncArtists,
    resetArtists,
    importArtists,
    addArtist,
    loadArtists,
    auth,
    onLogin,
    handleRedirect,
    login,
    logout,
    getAccessToken
}