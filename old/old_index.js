import keys from "../apikey.js";

let redirect_uri = keys.uri;
//let redirect_uri = "https://releasr.netlify.app/"
let client_id = keys.id;
let client_secret = keys.secret;
const authorize = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const followedartists = "https://api.spotify.com/v1/me/following?type=artist&limit=50";
const artistprofile = "https://api.spotify.com/v1/artists/";
const searchartist = "https://api.spotify.com/v1/search?type=artist&q=";
const userprofile = "https://api.spotify.com/v1/me";
const albumTracks = "https://api.spotify.com/v1/albums/"
let username = "";

const artistDivHTML = document.getElementById("artistFG").innerHTML;
const releasesDivHTML = document.getElementById("releases").innerHTML;

document.getElementById("artistAddInput")
    .addEventListener("keyup", function(event) {
        event.preventDefault();
        if (event.key === 'Enter') {
            addArtist();
        }
    });

/*
    Main = On Page Load
 */

let access_token = "";
let refresh_token = "";

let timeSpan = 30; //max days between today and release date
let usermarket = null;

window.onPageLoad = function (){
    const location = window.location.href.split("?")[0];
    if (location !== keys.uri) {
        console.log("wrong uri", location, keys.uri);
        return;
    }

    document.getElementById("app").style.display = 'none';
    if ( window.location.search.length > 0 ){
        handleRedirect();
    } else {
        access_token = localStorage.getItem("access_token");
        if ( access_token == null ){
            // we don't have an access token so present token section
            document.getElementById("authorize").style.display = 'flex';
            document.getElementById("app").style.display = 'none';
        }
        else {
            // present app section
            document.getElementById("app").style.display = 'block';
            document.getElementById("authorize").style.display = 'none';
            showUserInformation();
            //loadArtists(); wird nach showUserInformation aufgerufen in showUserInformation();
        }
    }
}

/*
    Show User Information
 */

function showUserInformation() {
    callApi("GET", userprofile, null, handleUserProfile );
}

function handleUserProfile() {
    console.log("API STATUS", this.status);
    if ( this.status === 200 ){
        loadSettings();
        let data = JSON.parse(this.responseText);
        if (usermarket === null)
            usermarket = data["country"];
        const displayname = data["display_name"];
        username = data.id;
        const loginImg = document.getElementById("loginImg");
        const loginUser = document.getElementById("loginUser");
        if (data["images"].length !== 0)
            loginImg.src = data["images"][0]["url"];
        loginUser.innerHTML = `Logged in as <p id="loginUserHighlight">${displayname}</p>`
        document.getElementById("logoutBtn").style.display = 'block';
        document.getElementById("settingsBtn").style.display = 'block';
        console.log(`Logged in as ${displayname}`);
        //LOADING ARTISTS ETC.
        loadArtists();
    }
    else if ( this.status === 401 ){
        refreshToken();
    }
    else {
        console.error(this.responseText);
        showError(true, this.status, "Unknown error, try reload page. Error context:\n" + this.responseText);
    }
}

window.saveSettings = function() {
    const input = document.getElementById("daysInput");
    const regioninput = document.getElementById("marketplaceInput");
    const time = input.value;
    const region = regioninput.value;
    if (time !== null) {
        if (isNaN(time) || time < 0 || time > 90) {
            showError(true, "Could not save settings", "Input is not a number")
        } else {
            localStorage.setItem("timeSpan", time);
            location.reload();
        }
    }
    if (region !== null) {
        localStorage.setItem("marketplace", region);
    }
}

function loadSettings() {
    const temp = localStorage.getItem("timeSpan");
    const region = localStorage.getItem("marketplace");
    if (temp !== null) {
        timeSpan = temp;
    }
    if (region !== null) {
        usermarket = region;
    }
}

/*
    New Artists Section
 */

let artistids = [];
let total = 0;

function loadArtists(){
    if (localStorage.getItem("artists"+username) !== null) {
        try {
            artistids = JSON.parse(localStorage.getItem("artists"+username));
        } catch (e) {
            showError(true, "Could not load artists", e)
        }
        console.log("loaded artists ", artistids);
        if (artistids.length === 0) {
            noSongsAvailable();
            return;
        }
        refreshAlbums();
    } else {
        console.log("reset & reload artists");
        artistids = [];
        getUsersArtistsNew(null);
    }
}

/* refresh artists from spotify api */
function getUsersArtistsNew(after) {
    if (after === null)
        callApi("GET", followedartists, null, handleGetUsersArtistsNew );
    else
        callApi("GET", followedartists+"&after="+after, null, handleGetUsersArtistsNew );
}

function handleGetUsersArtistsNew() {
    console.log("API STATUS", this.status);
    if ( this.status === 200 ){
        let data = JSON.parse(this.responseText);
        const items = data["artists"]["items"];
        const limit = data["artists"]["limit"];
        console.log("limit", limit);
        if (items.length === 0) {
            //artistids = [];
            saveArtistList();
            updateArtistDiv();
        } else {
            console.log("total", total);
            if (total === 0) {
                total = data["artists"]["total"];
                //TODO Bug: Items length larger than total (sync error?)
                if (total < items.length) {
                    console.warn("Total item count smaller than actual item count (Spotify Api Bug). Ignore this");
                    total = items.length;
                }
                if (limit < total) {
                    const lastArtist = items[items.length-1]["id"];
                    getUsersArtistsNew(lastArtist);
                }
            }
            updateArtistIDs(items);
        }
    }
    else if ( this.status === 401 ){
        refreshToken();
    }
    else {
        console.error(this.responseText);
        showError(true, this.status, "Unknown error, try reload page. Error context:\n" + this.responseText);
    }
}

function updateArtistIDs(items) {
    for (let x in items) {
        const current = { id : items[x]["id"], name : items[x]["name"], image : items[x]["images"][0]["url"], active : true, following : true};
        let inList = false;
        for (let y in artistids) {
            console.log("updateArtist",artistids[y].id,current.id);
            if (artistids[y].id === current.id) {
                if (!artistids[y].following) {
                    artistids[y].following = true;
                }
                inList = true;
                break;
            }
        }
        if (!inList) {
            artistids.push(current);
        }
    }
    saveArtistList();
    updateArtistDiv();
}

window.hideArtist = function (nr) {
    artistids[nr].active = !artistids[nr].active;
    saveArtistList();
    updateArtistDiv();
}

window.removeArtist = function (nr) {
    console.log("Remove", artistids);
    for (let k in artistids) {
        if (artistids[nr].name === artistids[k].name)
            artistids.splice(nr, 1);
    }
    localStorage.setItem("artists"+username, JSON.stringify(artistids));
    refreshAlbums();
    updateArtistDiv();
}

/* save artist list to localstorage & refresh div */
function saveArtistList() {
    localStorage.setItem("artists"+username, JSON.stringify(artistids));
    //const popup = document.getElementById("artistPopup");
    refreshAlbums();
}

let artistDivEnabled = false;
let settingsDivEnabled = false;

window.enableArtistsDiv = function (enable) {
    const popup = document.getElementById("artistPopup");
    artistDivEnabled = !artistDivEnabled;
    if (enable) {
        popup.style.display = "flex";
        document.body.style.overflow = "hidden";
        updateArtistDiv();
    } else {
        document.body.style.overflow = "auto";
        popup.style.display = "none";
    }
}

window.enableSettingsDiv = function (enable) {
    const popup = document.getElementById("settingsPopup");
    settingsDivEnabled = !settingsDivEnabled;
    if (enable) {
        popup.style.display = "flex";
        document.body.style.overflow = "hidden";
        updateSettingsDiv();
    } else {
        document.body.style.overflow = "auto";
        popup.style.display = "none";
    }
}

function updateSettingsDiv() {
    const input = document.getElementById("daysInput");
    const region = document.getElementById("marketplaceInput");
    input.value = timeSpan
    region.value = usermarket
}

function updateArtistDiv() {
    if (!artistDivEnabled)
        return;
    const div = document.getElementById("artistFG");
    if (artistids.length === 0) {
        div.innerHTML = artistDivHTML;
        noSongsAvailable();
    }
    let html = "";
    for (let x in artistids) {
        html += `<li id="artist-${x}" class="artistDiv">
                    <img src="${artistids[x].image}" alt="">
                        <p class="artistTitle">${artistids[x].name}</p>`
        if (artistids[x].following) {
            html += `<p class="artistSpotify"><i class="fa-solid fa-rotate"></i>Following</p>`
        }
        if (!artistids[x].following) {
            html += `<button onclick="removeArtist(${x})">Remove</button></li>`
        } else if (artistids[x].active) {
            html += `<button onclick="hideArtist(${x})">Hide</button></li>`
        } else {
            html += `<button onclick="hideArtist(${x})">Show</button></li>`
        }

    }
    div.innerHTML = artistDivHTML + html;
}

let searchq = null;
window.addArtist = function() {
    searchq = null;
    console.log("addArtist Window");
    const input = document.getElementById("artistAddInput");
    searchq = input.value;
    input.value = "";
    if (searchq === null || searchq === "")
        return;
    else if (searchq.startsWith("https")) {
        const split = searchq.split("?")[0].split("/");
        searchq = split[split.length-1];
    }
    callApi("GET", artistprofile+searchq, null, handleAddArtist );
}

function handleAddArtist() {
    if ( this.status === 200 ){
        let data = JSON.parse(this.responseText);
        const name = data["name"];
        if (name == null) {
            console.log("Artist ID not found");
            console.log(name);
            searchArtist();
            return;
        }
        const current = { id : data["id"], name : data["name"], image : data["images"][0]["url"], active : true, following : false};
        insertArtist(current);
    } else if ( this.status === 400 ) {
        console.log(name);
        searchArtist();
    }
    else if ( this.status === 401 ){
        refreshToken();
    }
    else {
        console.error(this.responseText);
        showError(true, "Error","Some error occured");
    }
}

function searchArtist() {
    callApi("GET", searchartist+searchq, null, function () {
        if ( this.status === 200 ){
            let data = JSON.parse(this.responseText);
            console.log(data);
            data = data.artists.items[0];
            const name = data["name"];
            console.log(data);
            if (name == null) {
                console.warn("Artist not found");
                return;
            }
            const current = { id : data["id"], name : data["name"], image : data["images"][0]["url"], active : true, following : false};
            insertArtist(current);
        }
        else if ( this.status === 401 ){
            refreshToken();
        }
        else {
            console.error(this.responseText);
            showError(true, "400","Artist not found: Provided ID or URL is invalid. Artist name won't work, use URL instead (In Spotify click share and copy link to artist) ");
        }
    });
}

/* add new artist to list */
function insertArtist(current) {
    console.log("insertArtist");
    for (let y in artistids) {
        if (artistids[y].id === current.id) {
            return;
        }
    }
    artistids.unshift(current);
    saveArtistList();
    updateArtistDiv();
}

// exüprt artists for debug purpose
window.exportArtists = async () => {
    try {
        await navigator.clipboard.writeText(JSON.stringify((artistids)));
        console.log('Content copied to clipboard');
        showMessage(true, 'Copied to clipbard', "")
    } catch (err) {
        showError(true, 'Failed to copy', err)
    }
}

window.importArtists = function() {
    const input = document.getElementById("importArtistsInput");
    let confirmAction = confirm("Are you sure you want override your artists?");
    if (confirmAction) {
        localStorage.setItem("artists"+username, input.value);
        location.reload();
    }
}

// reset artists
window.resetArtists = function() {
    let confirmAction = confirm("Are you sure you want to reset your artists? This will remove any artist except your followed artists on spotify");
    if (confirmAction) {
        localStorage.removeItem("artists"+username);
        location.reload();
    }
}

window.syncArtists = function() {
    removeSyncedArtists();
    console.log("resync artists but keep non-sync artists:", artistids);
    total = 0;
    getUsersArtistsNew(null);
}

function removeSyncedArtists() {
    let temp = [];
    for (let k in artistids) {
        if (!artistids[k].following)
            temp.push(artistids[k]);
    }
    artistids = temp;
}

/*
    New Album Collection Section. Called after artist load and after closing artist window
 */

let results = [];
let artists = [];

function refreshAlbums() {
    console.log("refreshing album for", artistids);
    results = [];
    artists = [];
    total = 0;
    if (artistids.size === 0) {
        noSongsAvailable();
        return;
    }
    total = artistids.length;
    for (let x in artistids) {
        if (artistids[x].active) {
            console.log("Collecting albums for artist", artistids[x].name)
            getAlbums(artistids[x].id);
        } else {
            total--; //Minus total, bc artist skipped
            if (total === 0)
                showResults();
            console.log("artist active?",artistids[x].name,artistids[x].active);
        }
    }
}

function getAlbums(id) {
    const artist = `https://api.spotify.com/v1/artists/${id}/albums?limit=50&include_groups=album,single`;
    callApi("GET", artist, null, handleArtistLoad );
}

function handleArtistLoad(){
    if ( this.status === 200 ){
        let data = JSON.parse(this.responseText);
        collectReleases(data);
    }
    else if ( this.status === 401 ){
        refreshToken();
    }
    else {
        console.error(this.responseText);
        showError(true, this.status, "Unknown error, try reload page. Error context:\n" + this.responseText);
    }
}

function collectReleases(data) {
    const items = data["items"];
    for (const x in items) {
        const item = items[x];
        const type = item["album_type"];
        const href = item["external_urls"]["spotify"];
        const image = item["images"][0]["url"];
        const name = item["name"];
        const release = item["release_date"];
        const artistsList = item["artists"];
        const mainartist = item["artists"][0]["name"];
        const tracks = item["total_tracks"];
        const markets = item["available_markets"];
        let artists = "";
        let fromVariousArtists = false;
        for (const z in artistsList) {
            artists += artistsList[z]["name"] + " &#8226; ";
            if (artistsList[z]["id"] === "0LyfQWJT6nXafLPZqxe9Of")
                fromVariousArtists = true;
        }
        artists = artists.substring(0, artists.length - 8);
        const date = convertDate(release);
        const intimespan = inTimeSpan(date);
        let duplicate = false;
        for (const y in results) {
            const tempname = results[y]["name"];
            const tempartist = results[y]["artists"];
            if (tempname === name && tempartist === artists)
                duplicate = true;
        }
        //TODO here (feature list for album), wsl nach untern verschieben
        /*let trackArtists = []
        if (type === "album") {
            callApi("GET", albumTracks + item["id"] + "/tracks", null, function () {
                let tracks = JSON.parse(this.responseText)["items"]
                for (let i=0; i<tracks.length; i++) {
                    for (let j=0; j<tracks[i]["artists"].length; j++) {
                        if (!trackArtists.includes(tracks[i]["artists"][j]["name"]))
                            trackArtists.push(tracks[i]["artists"][j]["name"])
                    }
                }
                console.log(trackArtists)
            } );
        }*/
        if (intimespan && !duplicate && !fromVariousArtists) {
            results.push({name, image, date, href, release, type, mainartist, artists, tracks, markets, advanced : item});
        }
    }
    total--;
    if (total === 0)
        showResults();
}

function convertDate(input) {
    let dateArray = input.split('-');
    return new Date(dateArray[0], dateArray[1]-1, dateArray[2]);
}

function inTimeSpan(date) {
    if (timeSpan === -1) {
        return true;
    }
    const now = new Date().getTime();
    let diff = Math.abs(now - date.getTime());
    diff = diff / (1000 * 60 * 60 * 24);
    return (diff <= timeSpan)
}

function noSongsAvailable() {
    document.getElementById("noartists").style.display = "block";
    document.getElementById("albumsbtn").style.display = "none";
    document.getElementById("singlebtn").style.display = "none";
    document.getElementById("featureBtn").style.display = "none";
}

/*
    Results & Filter Functions
 */

function showResults() {
    resetFilterOverlay();
    if (results.length === 0) {
        document.getElementById("releases").innerHTML = releasesDivHTML;
        noSongsAvailable();
        return;
    }
    results = sortResults(results);
    console.log("Found albums", results);
    let htmlstring = "";
    for (const x in results) {
        let isFeature = true;
        for (const y in artistids) {
            const temp = artistids[y].name;
            const mainartist = results[x]["mainartist"];
            if (mainartist.toLowerCase() === temp.toLowerCase()) {
                isFeature = false;
                break;
            }
        }
        let name = results[x]["name"];
        if (name.length >= 60) {
            name = name.substring(0, 59) + "...";
        }
        if (isFeature) {
            htmlstring += `<a style="background-image: url(' ${results[x]["image"]}')" href='${results[x]["href"]}'
                target="_blank" class="singleRelease isFeature ${results[x]['type'].toLowerCase()}">`
        } else {
            htmlstring += `<a style="background-image: url(' ${results[x]["image"]}')" href='${results[x]["href"]}' target="_blank" class="singleRelease ${results[x]['type'].toLowerCase()}">`
        }
        htmlstring += `<div class="blur"><img alt="Img" src="${results[x]["image"]}">
                <div class="rightContent">                    
                    <p class="releaseName">${name}</p>
                    <p class="releaseArtist">${results[x]["artists"]}</p>                
                </div><div class="lowerContent">`
        if (results[x]["tracks"] !== 1) {
            htmlstring += `<p class="releaseType"><i class="fas fa-music"></i> ${results[x]["tracks"]}</p>`;
        }
        htmlstring += `<p class="releaseType"><i class="fas fa-compact-disc"></i> ${results[x]["type"].toUpperCase()}</p>`;
        if (!results[x]["markets"].includes(usermarket)) {
            htmlstring += `<p class="releaseUnreleased"><i class="fa-solid fa-clock"></i> NOT RELEASED</p>`;
        } else {
            htmlstring += `<p class="releaseDate"><i class="fas fa-calendar"></i> ${dateToDEFormat(results[x]["date"],results[x]["release"])}</p>`;
        }
        htmlstring += `</div></div></a>`;
    }
    document.getElementById("releases").innerHTML = releasesDivHTML + htmlstring;
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

/* sort by date & main artist */
function sortResults(temp) {
    temp.sort((a,b) => a.mainartist.localeCompare(b.mainartist));
    temp.sort((a,b) => b.date.getTime() - a.date.getTime());
    return temp;
}

function showOverlay(i) {
    const overlay = document.getElementById("overlay");
    overlay.style.display = "block";
}

function hideOverlay(){
    const overlay = document.getElementById("overlay");
    overlay.style.display = "none";
}

/* only resets overlay, ignoring items */
function resetFilterOverlay() {
    albumtype = 0;
    showFeatures = true;
    document.getElementById("featureBtn").classList.add("inactiveBtn");
    document.getElementById("albumsbtn").classList.add("inactiveBtn");
    document.getElementById("singlebtn").classList.add("inactiveBtn");
    document.getElementById("featureBtn").classList.remove("activeBtn");
    document.getElementById("albumsbtn").classList.remove("activeBtn");
    document.getElementById("singlebtn").classList.remove("activeBtn");
}

let showFeatures = true;
window.toggleFeatures = function (){
    const featureElem = document.getElementById("featureBtn");
    showFeatures = !showFeatures;
    let elems = document.getElementsByClassName('isFeature');
    for (let i = 0; i < elems.length; ++i) {
        let item = elems[i];
        //Skip if filtered out otherwise
        if (item.classList.contains("album") && albumtype === 2 || item.classList.contains("single") && albumtype === 1)
            continue;
        if (!showFeatures) {
            item.style.display = 'none';
            featureElem.classList.add("activeBtn");
            featureElem.classList.remove("inactiveBtn");
        } else {
            featureElem.classList.remove("activeBtn");
            featureElem.classList.add("inactiveBtn");
            item.style.display = 'block';
        }

    }
    checkZeroElems();
}

let albumtype = 0; //0 = both (default), 1 = album only, 2 = single only
window.toggleAlbumType = function (clickedOnAlbums) {
    const albumElem = document.getElementById("albumsbtn");
    const singleElem = document.getElementById("singlebtn");
    if (clickedOnAlbums && albumtype === 1 || !clickedOnAlbums && albumtype === 2 ) {
        toggleAlbums(true);
        toggleSingles(true);
        albumtype = 0;
        albumElem.classList.remove("activeBtn");
        singleElem.classList.remove("activeBtn");
        albumElem.classList.add("inactiveBtn");
        singleElem.classList.add("inactiveBtn");
        //console.log("both off");
        //both off
    } else if (clickedOnAlbums) {
        toggleAlbums(true);
        toggleSingles(false);
        albumtype = 1;
        albumElem.classList.add("activeBtn");
        albumElem.classList.remove("inactiveBtn");
        singleElem.classList.remove("activeBtn");
        singleElem.classList.add("inactiveBtn");
        //console.log("album");
        //album light, single off
    } else {
        toggleAlbums(false);
        toggleSingles(true);
        albumtype = 2;
        singleElem.classList.add("activeBtn");
        singleElem.classList.remove("inactiveBtn");
        albumElem.classList.remove("activeBtn");
        albumElem.classList.add("inactiveBtn");
        //console.log("single");
        //album off, single light
    }
    checkZeroElems();
}

function toggleAlbums(enable){
    let elems = document.getElementsByClassName('album');
    for (let i = 0; i < elems.length; ++i) {
        let item = elems[i];
        if (item.classList.contains("isFeature") && !showFeatures)
            continue;
        if (!enable)
            item.style.display = 'none';
        else
            item.style.display = 'block';
    }
}

function toggleSingles(enable){
    let elems = document.getElementsByClassName('single');
    for (let i = 0; i < elems.length; ++i) {
        let item = elems[i];
        if (item.classList.contains("isFeature") && !showFeatures)
            continue;
        if (!enable)
            item.style.display = 'none';
        else
            item.style.display = 'block';
    }
}

function checkZeroElems(){
    let elems = document.getElementsByClassName('singleRelease');
    let active = elems.length;
    for (let i = 0; i < elems.length; ++i) {
        if (elems[i].style.display === "none")
            active--;
    }
    if (active === 0) {
        document.getElementById("emptyfilter").style.display = "block";
    } else {
        document.getElementById("emptyfilter").style.display = "none";
    }
}

/*
    Authorization & Login Section
 */

function handleRedirect() {
    let code = getCode();
    fetchAccessToken( code );
    window.history.pushState("", "", redirect_uri); // remove param from url
}

function fetchAccessToken( code ){
    let body = "grant_type=authorization_code";
    body += "&code=" + code;
    body += "&redirect_uri=" + encodeURI(redirect_uri);
    body += "&client_id=" + client_id;
    body += "&client_secret=" + client_secret;
    callAuthorizationApi(body);
}

function refreshToken() {
    refresh_token = localStorage.getItem("refresh_token");
    let body = "grant_type=refresh_token";
    body += "&refresh_token=" + refresh_token;
    body += "&client_id=" + client_id;
    callAuthorizationApi(body);
}

function callAuthorizationApi(body){
    let xhr = new XMLHttpRequest();
    xhr.open("POST", TOKEN, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(client_id + ":" + client_secret));
    xhr.send(body);
    xhr.onload = handleAuthorizationResponse;
}

function handleAuthorizationResponse(){
    if ( this.status === 200 ){
        let data = JSON.parse(this.responseText);
        if ( data.access_token != undefined ){
            access_token = data.access_token;
            localStorage.setItem("access_token", access_token);
        }
        if ( data.refresh_token  != undefined ){
            refresh_token = data.refresh_token;
            localStorage.setItem("refresh_token", refresh_token);
        }
        location.reload();
    }
    else {
        console.error(this.responseText);
        showError(true, this.status, "Unknown error, try reload page. Error context:\n" + this.responseText);
        logout();
    }
}

function getCode() {
    let code = null;
    const queryString = window.location.search;
    if ( queryString.length > 0 ){
        const urlParams = new URLSearchParams(queryString);
        code = urlParams.get('code')
    }
    return code;
}

//Authorize user to app
window.requestAuthorization = function (){
    let url = authorize;
    url += "?client_id=" + client_id;
    url += "&response_type=code";
    url += "&redirect_uri=" + encodeURI(redirect_uri);
    url += "&show_dialog=true";
    url += "&scope=user-follow-read user-read-private";
    //url += "&scope=user-follow-read user-read-private user-read-email user-modify-playback-state user-read-playback-position user-library-read streaming user-read-playback-state user-read-recently-played playlist-read-private";
    window.location.href = url; // Show Spotify's authorization screen
}

window.logout = function () {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    location.reload();
}

/*
    Spotify Api Call Function
 */

function callApi(method, url, body, callback){
    let xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
    xhr.send(body);
    xhr.onload = callback;
}

/*
    Error Handling
 */

window.showMessage = function(enable, title, subtitle) {
    const titleElem = document.getElementById("errorTitle");
    const subtitleElem = document.getElementById("errorSubtitle");
    const errorElem = document.getElementById("error");
    if (!enable) {
        errorElem.style.display = "none";
        return;
    }
    errorElem.style.display = "flex";
    errorElem.style.background = "#777777"
    titleElem.innerHTML = title;
    subtitleElem.innerHTML = subtitle;
}

window.showError = function(enable, title, subtitle) {
    const titleElem = document.getElementById("errorTitle");
    const subtitleElem = document.getElementById("errorSubtitle");
    const errorElem = document.getElementById("error");
    if (!enable) {
        errorElem.style.display = "none";
        return;
    }
    errorElem.style.display = "flex";
    titleElem.innerHTML = `Something went wrong: Error ${title} (Try reload page)`;
    subtitleElem.innerHTML = subtitle;
}
