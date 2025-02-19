/**
 * Main class for the frontend, handles all UI updates and user interactions
 * @class
 **/

import keys from "../apikey.js";
import logic from "./logic.js";
import logger from "./logger.js";
import { ErrorMessages } from "./enums/error-messages.enum.js";

// Stores HTML elements
const html = {
    authorize: document.getElementById("authorize"),
    app: document.getElementById("app"),
    settings_popup: document.getElementById("settingsPopup"),
    artists_popup: {
        popup: document.getElementById("artistPopup"),
        item: document.getElementById("artistFG"),
        inner: document.getElementById("artistFG").innerHTML,
        input: document.getElementById("artistAddInput"),
        list: document.getElementById("artistList")
    },
    playlist_popup: {
        popup: document.getElementById("playlistPopup"),
        item: document.getElementById("playlistFG"),
        inner: document.getElementById("playlistFG").innerHTML,
        input: document.getElementById("playlistAddInput"),
        list: document.getElementById("playlistList")
    },
    releases: {
        item: document.getElementById("releases"),
        inner: document.getElementById("releases").innerHTML,
    },
    user_info: {
        item: document.getElementById("loginInfo"),
        logo: document.getElementById("loginImg"),
        name: document.getElementById("loginUser"),
        logout_button: document.getElementById("logoutBtn"),
        settings_button: document.getElementById("settingsBtn")
    },
    filters: {
        album: document.getElementById("albumsbtn"),
        single: document.getElementById("singlebtn"),
        feature: document.getElementById("featureBtn")
    },
    no_artists: document.getElementById("noartists"),
    search_query_info: document.getElementById("search_query_info"),
    spinner: document.getElementById("spinner")
}

/*
    LOGIN & AUTH SECTION
*/

/* Main function, called on page load */
window.onPageLoad = function () {

    let location = window.location.href.split("?")[0];
    if (location.includes("netlify.app")) {
        location = location.replace("netlify.app", "noahschuette.de");
        window.location.href = location;
    }
    const locations = [keys.uri, keys.uri + "/", keys.uri + "/index.html"]
    if (!(locations.includes(location))) {
        logger.error(ErrorMessages.ILLEGAL_URI, "Entered URL: " + location);
        return;
    }

    html.app.style.display = "none";
    if (window.location.search.length > 0) {
        logic.handleRedirect();
    } else if (logic.getAccessToken() === null) {
        // we don't have an access token so present token section
        html.authorize.style.display = 'flex';
        html.app.style.display = 'none';
    } else {
        html.app.style.display = 'block';
        html.authorize.style.display = 'none';
        logic.login(onLogin);
    }
}

/* Called after successful login procedure */
function onLogin(response) {
    const user = logic.onLogin(response);
    html.user_info.logo.src = user.image
    html.user_info.name.innerHTML = `Logged in as <p id="loginUserHighlight">${user.displayname}</p>`
    html.user_info.logout_button.style.display = 'block';
    html.user_info.settings_button.style.display = 'block';
    console.log(`Logged in as ${user.displayname}`);
}

/* From "Connect with Spotify Button", request Authoriazation */
window.requestAuthorization = function () {
    logic.auth();
}

/* Logs out the user */
window.logout = function () {
    logic.logout();
}

/*
    PROXY FOR UPDATING DIVS
*/

/* Stores if divs are active or not */
let divs = {
    artists: false,
    settings: false,
    playlist: false,
}

/* Proxy, handles backend changes automatically */
const proxy_debug = localStorage.getItem("proxy_debug");
let target_ = {};
const targetProxy = new Proxy(target_, {
    set: function (target, key, value) {
        if (proxy_debug === 'true') {
            console.log(`${key} updated`);
        }
        target[key] = value;
        if (key == "artists" && divs.artists) {
            document.getElementById("artistSync").innerHTML = `<i class="fa-solid fa-rotate"></i>Sync with Spotify`;
            updateArtistsDiv()
        } else if (key == "playlists" && divs.playlist) {
            updatePlaylistDiv();
        } else if (key == "settings" && divs.settings) {
            updateSettingsDiv()
        } else if (!divs.settings && !divs.artists) {
            if (key == "albums") {
                updateAlbumsDiv()
            } else if (key == "filters") {
                updateFilterOverlay();
            } else if (key == "saved") {
                updateLikedButton();
            }
        }
        return true;
    }
})

/*
    SETTINGS DIV
*/

/* From Your Settings Button */
window.enableSettingsDiv = function (enable) {
    if (enable) {
        html.settings_popup.style.display = "flex";
        document.body.style.overflow = "hidden";
        divs.settings = true;
        updateSettingsDiv();
    } else {
        document.body.style.overflow = "auto";
        html.settings_popup.style.display = "none";
        divs.settings = false;
    }
}

/* Build settings div after settings change */
function updateSettingsDiv() {
    if (!divs.settings) {
        console.warn("Updated settings div, even though its inactive")
    }
    if (target_.settings === undefined) {
        console.error("Updated settings div, even though settings are null");
        return;
    }
    const input = document.getElementById("daysInput");
    const region = document.getElementById("marketplaceInput");
    const playlist_select = document.getElementById("playlistSelect");
    const sort_select = document.getElementById("sortSelect");
    const advanced_filter = document.getElementById("advancedfilterInput");
    const not_save_doubles = document.getElementById("savedoublesInput");
    input.value = target_.settings.timespan;
    region.value = target_.settings.market;
    advanced_filter.checked = target_.settings.advanced_filter;
    not_save_doubles.checked = target_.settings.not_save_doubles;
    const playlists = target_.settings.playlists;
    playlist_select.innerHTML = `
        <option value="none">None</option>
        <option value="your_library">Your Library</option>
    `;
    for (let i in playlists) {
        let option = document.createElement("option");
        option.value = playlists[i].id;
        option.innerHTML = playlists[i].name;
        playlist_select.appendChild(option);
    }
    playlist_select.value = target_.settings.active_playlist;
    sort_select.value = target_.settings.sort_by;
}

window.saveSettings = function () {
    const time = document.getElementById("daysInput").value;
    const region = document.getElementById("marketplaceInput").value;
    const active_playlist = document.getElementById("playlistSelect").value;
    const advanced_filter = document.getElementById("advancedfilterInput").checked;
    const not_save_doubles = document.getElementById("savedoublesInput").checked;
    const sort_by = document.getElementById("sortSelect").value;
    logic.saveSettings(time, region, active_playlist, advanced_filter, not_save_doubles, sort_by);
}

/*
    RELEASE-PLAYLIST DIV
*/

window.enablePlaylistDiv = function (enable) {
    if (enable) {
        document.getElementById("playlistAddInput").value = "";
        html.playlist_popup.popup.style.display = "flex";
        document.body.style.overflow = "hidden";
        divs.playlist = true;
        logic.searchPlaylist("");
    } else {
        document.body.style.overflow = "auto";
        html.playlist_popup.popup.style.display = "none";
        divs.playlist = false;
        logic.refreshAlbums();
    }
}

const playlist_input = document.getElementById("playlistAddInput");
playlist_input.addEventListener("input", function () {
    logic.searchPlaylist(playlist_input.value);
});

/* Build artist div after artists change */
function updatePlaylistDiv() {
    const query = document.getElementById("playlistAddInput").value
    if (!divs.playlist) {
        console.warn("Updated playlist div, even though its inactive")
    }
    if (target_.playlists === undefined) {
        console.error("Updated playlists div, even though playlists are null");
        return;
    }
    let html_ = "";
    let inSearchSection = false;

    for (let x in target_.playlists) {
        if (target_.playlists[x].added !== false && query !== "" && target_.playlists[x].name.toLowerCase().includes(query.toLowerCase()) === false) {
            continue;
        }
        if (!inSearchSection && target_.playlists[x].added === false) {
            inSearchSection = true;
            html_ += `<p id="searchSection"><i class="fa-brands fa-spotify"></i> Search Suggestions</p>`
        }
        html_ += `<li id="playlist-${x}" class="playlistDiv">`;
        if (target_.playlists[x].image !== null) {
            html_ += `<img src="${target_.playlists[x].image}" alt=""></img>`;
        } else {
            html_ += `<img src="images/profilepic_gray.png" alt=""></img>`;
        }
        html_ += `
        <div class="playlistTitleDiv">
        <p class="playlistTitle">${target_.playlists[x].name}</p>
        <p class="playlistOwner">${target_.playlists[x].owner}</p>
        </div>
        `;
        if (!target_.playlists[x].added) {
            html_ += `<button onclick="addPlaylist('${target_.playlists[x].id}')"><i class="fa-solid fa-plus"></i></button></li>`
        } else {
            html_ += `<button class="artistRemove" onclick="removePlaylist(${x})"><i class="fa-solid fa-minus"></i></button></li>`;
        }
    }

    if (html_.length === 0 && query === "") {
        html_ += `<div id="noartistssearch">
        <img src="images/releaseplaylist_feature.png">
        <p><span>NO PLAYLISTS ADDED</span><br>Add several playlists like "Release Radar" or "New Music Friday" and we will extract new releases from those lists</p></div>`
    } else if (html_.length === 0) {
        html_ += `<div id="noartistssearch"><p>No playlists found for your search</p></div>`
    }
    html.playlist_popup.list.innerHTML = html_;
}

window.addPlaylist = function (id) {
    document.getElementById("playlistAddInput").value = "";
    logic.addPlaylist(id);
}

window.removePlaylist = function (nr) {
    document.getElementById("playlistAddInput").value = "";
    logic.removePlaylist(nr);
}

/*
    ARTIST DIV
*/

/* From Your Artists Button */
window.enableArtistsDiv = function (enable) {
    if (enable) {
        html.artists_popup.popup.style.display = "flex";
        document.body.style.overflow = "hidden";
        divs.artists = true;
        logic.searchArtist(""); // empty search that updates artist div afterwards
    } else {
        document.getElementById("artistAddInput").value = "";
        document.body.style.overflow = "auto";
        html.artists_popup.popup.style.display = "none";
        divs.artists = false;
        logic.refreshAlbums();
    }
}

const input_ = document.getElementById("artistAddInput");
input_.addEventListener("input", function () {
    logic.searchArtist(input_.value);
});

/* Build artist div after artists change */
function updateArtistsDiv() {
    const query = document.getElementById("artistAddInput").value
    if (!divs.artists) {
        console.warn("Updated artists div, even though its inactive")
    }
    if (target_.artists === undefined) {
        console.error("Updated artists div, even though artists are null");
        return;
    }
    let html_ = "";
    let inSearchSection = false;
    for (let x in target_.artists) {
        if (target_.artists[x].added !== false && query !== "" && target_.artists[x].name.toLowerCase().includes(query.toLowerCase()) === false) {
            continue;
        }
        if (!inSearchSection && target_.artists[x].added === false) {
            inSearchSection = true;
            html_ += `<p id="searchSection"><i class="fa-brands fa-spotify"></i> Search Suggestions</p>`
        }
        html_ += `<li id="artist-${x}" class="artistDiv">`;
        if (target_.artists[x].image !== null) {
            html_ += `<img src="${target_.artists[x].image}" alt=""></img>`;
        } else {
            html_ += `<img src="images/profilepic_gray.png" alt=""></img>`;
        }
        html_ += `<p class="artistTitle">${target_.artists[x].name}</p>`;
        if (!target_.artists[x].added) {
            html_ += `<button onclick="addArtist('${target_.artists[x].id}')"><i class="fa-solid fa-plus"></i></button></li>`
        } else {
            if (target_.artists[x].following) {
                html_ += `<p class="artistSpotify"><i class="fa-solid fa-rotate"></i>Following</p>`
            }
            html_ += `<button class="artistRemove" onclick="removeArtist(${x})"><i class="fa-solid fa-minus"></i></button></li>`;

        }
    }
    if (html_.length === 0 && query === "") {
        html_ += `<div id="noartistssearch">
        <img src="images/artists_feature.png">
        <p><span>NO ARTISTS ADDED</span><br>Add your favorite artists to this list and we will display the newest releases from them</p></div>`
    } else if (html_.length === 0) {
        html_ += `<p id="noartistssearch">No artists found for your search</p>`
    }
    html.artists_popup.list.innerHTML = html_;
}

/*
window.addEventListener("keydown", function(event) {
    if (!divs.artists) {
        return;
    }
    if (event.key === "Enter") {
        window.addArtist();
    } 
});
*/

window.addArtist = function (id) {
    document.getElementById("artistAddInput").value = "";
    logic.addArtist(id);
}

/* Functions to manage artists, calling backend */

window.exportData = function () {
    logic.exportData();
}

/* Import artists from clipboard */
window.importData = function () {
    const input = document.getElementById("importArtistsInput");
    let confirmAction = confirm("Are you sure you want override your data?");
    if (confirmAction) {
        logic.importData(input.value);
    }
}

window.deleteData = function () {
    let confirmAction = confirm("Are you sure you want to delete your data? This will remove any stored data including your artists and log you out");
    if (confirmAction) {
        logic.deleteData();
    }
}

window.syncArtists = function () {
    const item = document.getElementById("artistSync");
    item.innerHTML = "Syncing artists..."
    item.disabled = true;
    logic.syncArtists();
}

window.hideArtist = function (nr) {
    document.getElementById("artistAddInput").value = "";
    logic.hideArtist(nr);
}

window.removeArtist = function (nr) {
    document.getElementById("artistAddInput").value = "";
    logic.removeArtist(nr);
}

/*
    ALBUM DIV
*/

function updateAlbumsDiv() {
    if (target_.albums === undefined) {
        console.error("Updated albums div, even though albums are null");
        return;
    }

    html.spinner.style.display = "none";
    html.search_query_info.innerHTML = `Showing releases for ${logic.getActiveArtists()} artists & ${logic.getReleasePlaylistCount()} playlists in the last ${logic.getTimespan()} days`;

    // If no albums available: show empty list
    if (target_.albums.length === 0) {
        html.releases.item.innerHTML = html.releases.inner;
        html.releases.item.children[0].style.display = "block";
        return;
    }

    const results = target_.albums;
    let htmlstring = "";

    // Add each result
    for (const x in results) {
        const result = results[x].album;
        if (!result.show) {
            continue;
        }
        if (result.title.length >= 60) {
            result.title = result.title.substring(0, 59) + "...";
        }

        result.dummy++;

        let artist_string = "";
        for (const z in result.artists_list) {
            artist_string += result.artists_list[z] + " &#8226; ";
        }
        artist_string = artist_string.substring(0, artist_string.length - 8);
        if (result.isfeature) {
            htmlstring += `<div class="singleRelease isFeature
            ${result.type.toLowerCase()}">`
        } else {
            htmlstring += `<div class="singleRelease
            ${result.type.toLowerCase()}">`
        }

        htmlstring += `<div class="songUpper">`

        htmlstring += `<a class="blur" href='${result.href}' target="_blank" ><img alt="Img" src="${result.image}">
            <div class="rightContent">                    
                <p class="releaseName">${result.title}</p>
                <p class="releaseArtist">${artist_string}</p>                
            </div><div class="lowerContent">`
        if (result.shown_in !== "") {
            htmlstring += `<p class="releasePlaylist"><i class="fa-solid fa-bars-staggered"></i> ${result.shown_in.toUpperCase().trim()}</p>`;
        }
        if (result.tracks !== 1) {
            htmlstring += `<p class="releaseType"><i class="fas fa-music"></i> ${result.tracks}</p>`;
        }
        htmlstring += `<p class="releaseType"><i class="fas fa-compact-disc"></i> ${result.type.toUpperCase()}</p>`;
        /*if (!result.markets.includes(backend.getMarket())) {
            htmlstring += `<p class="releaseUnreleased"><i class="fa-solid fa-clock"></i> UNRELEASED</p>`;
        } else {*/
        htmlstring += `<p class="releaseDate"><i class="fas fa-calendar"></i> ${dateToDEFormat(result.release_date, result.real_date)}</p>`;
        /*}*/
        htmlstring += `</div></a>`;
        const album_id = result.href.split("/")[4];
        if (result.tracks !== 1) {
            htmlstring += `<button onclick="toggleSongs('${album_id}')" class="saveSongButton saveSongButtonPre" id="songListButton_${album_id}"><i class="fa-solid fa-chevron-down"></i></button>`
        }
        let isSingle = true;
        if (result.type.toUpperCase() === "ALBUM") {
            isSingle = false;
        }
        if (!(logic.albumIsSaved(album_id))) {
            htmlstring += `<button onclick="saveAlbum('${album_id}',${isSingle})" class="saveSongButton saveSongButtonPre" id="saveSongButton_${album_id}"><i class="fa-regular fa-heart"></i></button>`
        } else {
            htmlstring += `<button disabled onclick="saveAlbum('${album_id}',${isSingle})" class="saveSongButton saveSongButtonAfter" id="saveSongButton_${album_id}"><i class="fa-solid fa-heart"></i></button>`
        }

        htmlstring += `</div>` // end upper content

        if (result.tracks !== 1) {
            htmlstring += `<table cellspacing="0" class="songLower" id="songLower_${album_id}">`
            for (const y in result.songs) {
                if (y % 2 === 0) {
                    htmlstring += `<tr class="song evenSong">`;
                } else {
                    htmlstring += `<tr class="song">`;
                }
                htmlstring += `<th class="songNumber">${parseInt(y) + 1}:</th>`;
                htmlstring += `<th class="songTitle">${result.songs[y].name}</th>`;
                htmlstring += `<th>`
                for (const z in result.songs[y].artists) {
                    const artist = result.songs[y].artists[z];
                    htmlstring += `${artist}`;
                    if (z != result.songs[y].artists.length - 1) {
                        htmlstring += ` &#8226; `;
                    }
                }
                htmlstring += `</th></tr>` // end song
            }
            htmlstring += `</table>` // end lower content
        }

        htmlstring += `</div>` // end whole content
    }
    if (htmlstring === "") {
        html.releases.item.innerHTML = html.releases.inner;
        html.releases.item.children[0].style.display = "block";
    } else {
        html.releases.item.innerHTML = html.releases.inner + htmlstring;
    }
}


function dateToDEFormat(date, releaseDate) {
    const now = new Date();
    const msBetweenDates = now.getTime() - date.getTime();
    const daysBetweenDates = Math.floor(msBetweenDates / (60 * 60 * 1000 * 24));
    if (daysBetweenDates < 0) {
        return releaseDate;
    }
    if (daysBetweenDates === 0) {
        return "TODAY";
    } else if (daysBetweenDates === 1) {
        return "YESTERDAY";
    } else if (daysBetweenDates < 7) {
        return daysBetweenDates + " DAYS AGO";
    }
    return releaseDate;
}

function resetFilterOverlay() {
    filters.album = false;
    filters.single = false;
    filters.feature = false;
    updateFilterOverlay();
}

/* Update UI of all filters */
function updateFilterOverlay() {
    const filters = target_.filters;
    if (!filters.album) {
        html.filters.album.classList.add("inactiveBtn");
        html.filters.album.classList.remove("activeBtn");
    } else {
        html.filters.album.classList.remove("inactiveBtn");
        html.filters.album.classList.add("activeBtn");
    }
    if (!filters.single) {
        html.filters.single.classList.add("inactiveBtn");
        html.filters.single.classList.remove("activeBtn");
    } else {
        html.filters.single.classList.remove("inactiveBtn");
        html.filters.single.classList.add("activeBtn");
    }
    /*if (!filters.feature) {
        html.filters.feature.classList.add("inactiveBtn");
        html.filters.feature.classList.remove("activeBtn");
    } else {
        html.filters.feature.classList.remove("inactiveBtn");
        html.filters.feature.classList.add("activeBtn");
    }*/
}

/* Toggles filters */
window.toggleFeatures = function () {
    logic.toggleFilters(false, false, true)
}

window.toggleAlbumFilter = function () {
    logic.toggleFilters(true, false, false)
}

window.toggleSingleFilter = function () {
    logic.toggleFilters(false, true, false)
}

window.saveAlbum = function (album, isSingle) {
    if (logic.getActivePlaylist() !== 'none') {
        const elem = document.getElementById(`saveSongButton_${album}`);
        elem.disabled = true;
    }
    logic.saveAlbum(album, isSingle);
}

window.toggleSongs = function (album) {
    const elem = document.getElementById(`songLower_${album}`);
    if (elem.style.display !== "table") {
        elem.style.display = "table";
        document.getElementById(`songListButton_${album}`).innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
    } else {
        elem.style.display = "none";
        document.getElementById(`songListButton_${album}`).innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
    }
}

function updateLikedButton() {
    if (target_.saved === undefined) {
        console.error("Updated liked button, even though saved is null");
        return;
    }
    const elem = document.getElementById(`saveSongButton_${target_.saved}`);
    elem.classList.remove("saveSongButtonPre");
    elem.classList.add("saveSongButtonAfter");
    elem.innerHTML = '<i class="fa-solid fa-heart"></i>';
}

export default targetProxy;