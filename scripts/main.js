/**
 * Frontend. Calls the backend and sets HTML elements if backend changes
 * @class
**/

import keys from "../apikey.js";
import backend from "./backend.js";

// Stores HTML elements
const html = {
    authorize : document.getElementById("authorize"),
    app : document.getElementById("app"),
    settings_popup : document.getElementById("settingsPopup"),
    artists_popup : {
        popup : document.getElementById("artistPopup"),
        item : document.getElementById("artistFG"),
        inner : document.getElementById("artistFG").innerHTML,
        input : document.getElementById("artistAddInput")
    },
    releases : {
        item : document.getElementById("releases"),
        inner : document.getElementById("releases").innerHTML
    },
    user_info : {
        item : document.getElementById("loginInfo"),
        logo : document.getElementById("loginImg"),
        name : document.getElementById("loginUser"),
        logout_button : document.getElementById("logoutBtn"),
        settings_button : document.getElementById("settingsBtn")
    },
    filters : {
        album : document.getElementById("albumsbtn"),
        single : document.getElementById("singlebtn"),
        feature : document.getElementById("featureBtn")
    },
    no_artists : document.getElementById("noartists"),
    search_query_info : document.getElementById("search_query_info")
}

/*
    LOGIN & AUTH SECTION
*/

/* Main function, called on page load */
window.onPageLoad = function() {
    const location = window.location.href.split("?")[0];
    const locations = [keys.uri, keys.uri.slice(0, -1), keys.uri + "/index.html"]
    if (!(locations.includes(location))) {
        console.error("wrong uri", locations, location);
        return;
    }

    html.app.style.display = "none";
    if ( window.location.search.length > 0 ) {
        backend.handleRedirect();
    } else if ( backend.getAccessToken() === null ) {
        // we don't have an access token so present token section
        html.authorize.style.display = 'flex';
        html.app.style.display = 'none';
    } else {
        html.app.style.display = 'block';
        html.authorize.style.display = 'none';
        backend.login(onLogin);
    }
}

/* Called after successful login procedure */
function onLogin(response) {
    const user = backend.onLogin(response);
    html.user_info.logo.src = user.image
    html.user_info.name.innerHTML = `Logged in as <p id="loginUserHighlight">${user.displayname}</p>`
    html.user_info.logout_button.style.display = 'block';
    html.user_info.settings_button.style.display = 'block';
    console.log(`Logged in as ${user.displayname}`);

    backend.loadArtists();
}

/* From "Connect with Spotify Button", request Authoriazation */
window.requestAuthorization = function() {
    backend.auth();
}

/* Logs out the user */
window.logout = function () {
    backend.logout();
}

/*
    PROXY FOR UPDATING DIVS
*/

/* Stores if divs are active or not */ 
let divs = {
    artists : false,
    settings : false
}

/* Proxy, handles backend changes automatically */
let target_ = {};
const targetProxy = new Proxy(target_, {
    set: function(target, key, value) {
        console.log(`${key} updated`);
        target[key] = value;
        if (key == "artists" && divs.artists) {
            updateArtistsDiv()
        } else if (key == "settings" && divs.settings) {
            updateSettingsDiv()
        } else if (key == "albums" && !divs.settings && !divs.artists) {
            updateAlbumsDiv()
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
    input.value = target_.settings.timespan;
    region.value = target_.settings.market;
    const playlists = target_.settings.playlists;
    for (let i in playlists){
        let option = document.createElement("option");
        option.value = playlists[i].id;
        option.innerHTML = playlists[i].name;
        playlist_select.appendChild(option);
    }
    playlist_select.value = target_.settings.active_playlist;
}

window.saveSettings = function() {
    const time = document.getElementById("daysInput").value;
    const region = document.getElementById("marketplaceInput").value;
    const active_playlist = document.getElementById("playlistSelect").value;
    backend.saveSettings(time, region, active_playlist);
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
        updateArtistsDiv();
    } else {
        document.body.style.overflow = "auto";
        html.artists_popup.popup.style.display = "none";
        divs.artists = false;
        backend.refreshAlbums();
    }
}

/* Build artist div after artists change */
function updateArtistsDiv() {
    if (!divs.artists) {
        console.warn("Updated artists div, even though its inactive")
    }
    if (target_.artists === undefined) {
        console.error("Updated artists div, even though artists are null");
        return;
    }
    if (target_.artists.length === 0) {
        html.artists_popup.item.innerHTML = html.artists_popup.inner;
    }
    let html_ = "";
    for (let x in target_.artists) {
        html_ += `<li id="artist-${x}" class="artistDiv">
                    <img src="${target_.artists[x].image}" alt="">
                        <p class="artistTitle">${target_.artists[x].name}</p>`
        if (target_.artists[x].following) {
            html_ += `<p class="artistSpotify"><i class="fa-solid fa-rotate"></i>Following</p>`
        }
        if (!target_.artists[x].following) {
            html_ += `<button onclick="removeArtist(${x})">Remove</button></li>`
        } else if (target_.artists[x].active) {
            html_ += `<button onclick="hideArtist(${x})">Hide</button></li>`
        } else {
            html_ += `<button onclick="hideArtist(${x})">Show</button></li>`
        }
    }
    html.artists_popup.item.innerHTML = html.artists_popup.inner + html_;
}

let searchq = null;
window.addArtist = function() {
    const input = document.getElementById("artistAddInput");
    searchq = input.value;
    input.value = "";
    backend.addArtist(searchq);
}

/* Functions to manage artists, calling backend */

window.exportArtists = function() {
    backend.exportArtists();
}

/* Import artists from clipboard */
window.importArtists = function() {
    const input = document.getElementById("importArtistsInput");
    let confirmAction = confirm("Are you sure you want override your artists?");
    if (confirmAction) {
        backend.importArtists(input.value);
    }
}

window.resetArtists = function() {
    let confirmAction = confirm("Are you sure you want to reset your artists? This will remove any artist except your followed artists on spotify");
    if (confirmAction) {
        backend.resetArtists();
    }
}

window.syncArtists = function() {
    backend.syncArtists();
}

window.hideArtist = function(nr) {
    backend.hideArtist(nr);
}

window.removeArtist = function (nr) {
    backend.removeArtist(nr);
}

/*
    ALBUM DIV
*/

let filters = {
    album : false,
    single : false,
    feature : false
}

function updateAlbumsDiv() {
    if (target_.albums === undefined) {
        console.error("Updated albums div, even though albums are null");
        return;
    }

    html.search_query_info.innerHTML = `Showing releases for ${backend.getActiveArtists()} artists in the last ${backend.getTimespan()} days`;

    // If no albums available: show empty list
    if (target_.albums.length === 0) {
        html.releases.item.innerHTML = html.releases.inner;
        html.releases.item.children[0].style.display = "block";
        return;
    }

    //resetFilterOverlay();

    console.log(target_.albums)

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
        htmlstring += `<a class="blur" href='${result.href}' target="_blank" ><img alt="Img" src="${result.image}">
            <div class="rightContent">                    
                <p class="releaseName">${result.title}</p>
                <p class="releaseArtist">${artist_string}</p>                
            </div><div class="lowerContent">`
        if (result.tracks !== 1) {
            htmlstring += `<p class="releaseType"><i class="fas fa-music"></i> ${result.tracks}</p>`;
        }
        htmlstring += `<p class="releaseType"><i class="fas fa-compact-disc"></i> ${result.type.toUpperCase()}</p>`;
        if (!result.markets.includes(backend.getMarket())) {
            htmlstring += `<p class="releaseUnreleased"><i class="fa-solid fa-clock"></i> UNRELEASED</p>`;
        } else {
            htmlstring += `<p class="releaseDate"><i class="fas fa-calendar"></i> ${dateToDEFormat(result.release_date,result.real_date)}</p>`;
        }
        htmlstring += `</div></a>`;
        htmlstring += `<button onclick="saveSong('${result.href.split("/")[4]}')" class="saveSongButton saveSongButtonPre" id="saveSongButton_${result.href.split("/")[4]}"><i class="fa-regular fa-heart"></i></button>`
        htmlstring += `</div>`
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
    if (!filters.feature) {
        html.filters.feature.classList.add("inactiveBtn");
        html.filters.feature.classList.remove("activeBtn");
    } else {
        html.filters.feature.classList.remove("inactiveBtn");
        html.filters.feature.classList.add("activeBtn");
    }
}

/* Toggles filters */
window.toggleFeatures = function() {
    filters.feature = !filters.feature;
    updateFilterOverlay();
    backend.filterAlbums(filters);
}

window.toggleAlbumFilter = function() {
    if (filters.album) {
        filters.album = false;
    } else {
        filters.album = true;
        filters.single = false;
    }
    updateFilterOverlay();
    backend.filterAlbums(filters);
}

window.toggleSingleFilter = function() {
    if (filters.single) {
        filters.single = false;
    } else {
        filters.single = true;
        filters.album = false;
    }
    updateFilterOverlay();
    backend.filterAlbums(filters);
}

window.saveSong = function(song) {
    if (backend.getActivePlaylist() !== 'none') {
        const elem = document.getElementById(`saveSongButton_${song}`);
        elem.classList.remove("saveSongButtonPre");
        elem.classList.add("saveSongButtonAfter");
        elem.innerHTML = '<i class="fa-solid fa-heart"></i>';
        elem.disabled = true;
    }
    backend.saveSong(song);
}

export default targetProxy;