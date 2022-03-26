const timeSpan = 30; //max days between today and release date
//let redirect_uri = "http://127.0.0.1:63342/spotifyRelease/index.html"; //requires adress of index.html in current environment
let redirect_uri = "https://releasr.netlify.app/"
let client_id = localStorage.getItem("client_id");
let client_secret = localStorage.getItem("client_secret");
const authorize = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const followedartists = "https://api.spotify.com/v1/me/following?type=artist&limit=50";
const userprofile = "https://api.spotify.com/v1/me";

/*
    Main = On Page Load
 */

function onPageLoad(){
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
            getUsersArtists();
        }
    }
}

/*
    Artists Collection Section
 */

function getUsersArtists() {
    callApi("GET", followedartists, null, handleGetUsersArtists );
}

function getNextUsersArtists(after) {
    callApi("GET", followedartists+"&after="+after, null, handleGetUsersNextArtists );
}

function handleGetUsersNextArtists() {
    if ( this.status == 200 ){
        let data = JSON.parse(this.responseText);
        console.log(data, document.body);
        albumsPerArtist(data);
    }
    else if ( this.status == 401 ){
        refreshToken();
    }
    else {
        console.error(this.responseText);
    }
}

function handleGetUsersArtists() {
    if ( this.status == 200 ){
        let data = JSON.parse(this.responseText);
        //console.log(data, document.body);
        if (data["artists"]["items"].length === 0) {
            noSongsAvailable();
        } else {
            albumsPerArtist(data);
        }
    }
    else if ( this.status == 401 ){
        refreshToken();
    }
    else {
        console.error(this.responseText);
    }
}

function noSongsAvailable() {
    document.getElementById("noartists").style.display = "block";
    document.getElementById("filter").style.display = "none";
}

let results = [];
let artists = [];
let total = 0;

function albumsPerArtist(data) {
    const items = data["artists"]["items"];
    const limit = data["artists"]["limit"];
    if (total === 0) {
        total = data["artists"]["total"];
        //TODO Bug: Items length larger than total (sync error?)
        if (total < items.length) {
            console.warn("Total item count smaller than actual item count (Spotify Api Bug). Ignore this");
            total = items.length;
        }
    }
    let anothersearch = false;
    if (limit < total) {
        anothersearch = true;
    }
    let id = "";
    for (const x in items) {
        id = items[x]['id'];
        getAlbums(id);
        name = items[x]['name'];
        artists.push(name);
    }
    if (anothersearch) {
        getNextUsersArtists(id);
    }
}

function getAlbums(id) {
    const artist = `https://api.spotify.com/v1/artists/${id}/albums?limit=50&include_groups=album,single`;
    callApi("GET", artist, null, handleArtistLoad );
}

function callApi(method, url, body, callback){
    let xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);
    xhr.send(body);
    xhr.onload = callback;
}

function handleArtistLoad(){
    if ( this.status == 200 ){
        var data = JSON.parse(this.responseText);
        collectReleases(data);
    }
    else if ( this.status == 401 ){
        refreshToken();
    }
    else {
        console.error(this.responseText);
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
        if (intimespan && !duplicate && !fromVariousArtists) {
            results.push({name, image, date, href, release, type, mainartist, artists, tracks});
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
    const now = new Date().getTime();
    let diff = Math.abs(now - date.getTime());
    diff = diff / (1000 * 60 * 60 * 24);
    return (diff <= timeSpan)
}

/*
    Results & Filter Functions
 */

function showResults() {
    console.log("Results", results);
    console.log("Artists", artists);
    if (results.length === 0) {
        noSongsAvailable();
        return;
    }
    results.sort(function(a, b) {
        return b["date"] - a["date"];
    });
    let htmlstring = "";
    for (const x in results) {
        let isFeature = true;
        for (const y in artists) {
            const temp = artists[y];
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
        //onclick showOverlay(x)
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
        htmlstring += `<p class="releaseType"><i class="fas fa-compact-disc"></i> ${results[x]["type"].toUpperCase()}</p>
            <p class="releaseDate"><i class="fas fa-calendar"></i> ${results[x]["release"]}</p></div></div></a>`;
    }
    document.getElementById("releases").innerHTML = htmlstring;
}

function showOverlay(i) {
    const overlay = document.getElementById("overlay");
    overlay.style.display = "block";
}

function hideOverlay(){
    const overlay = document.getElementById("overlay");
    overlay.style.display = "none";
}

let showFeatures = true;
function toggleFeatures(){
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
}

let albumtype = 0; //0 = both (default), 1 = album only, 2 = single only
function toggleAlbumType(clickedOnAlbums) {
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

/*
    Show User Information
 */

function showUserInformation() {
    callApi("GET", userprofile, null, handleUserProfile );
}

function handleUserProfile() {
    if ( this.status === 200 ){
        let data = JSON.parse(this.responseText);
        const displayname = data["display_name"];
        const loginImg = document.getElementById("loginImg");
        const loginUser = document.getElementById("loginUser");
        if (data["images"].length !== 0)
            loginImg.src = data["images"][0]["url"];
        loginUser.innerHTML = `Logged in as <p id="loginUserHighlight">${displayname}</p>`
        document.getElementById("logoutBtn").style.display = 'block';
        console.log(`Logged in as ${displayname}`);
    }
    else if ( this.status === 401 ){
        refreshToken();
    }
    else {
        console.error(this.responseText);
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
    if ( this.status == 200 ){
        var data = JSON.parse(this.responseText);
        //console.log(data);
        var data = JSON.parse(this.responseText);
        if ( data.access_token != undefined ){
            access_token = data.access_token;
            localStorage.setItem("access_token", access_token);
        }
        if ( data.refresh_token  != undefined ){
            refresh_token = data.refresh_token;
            localStorage.setItem("refresh_token", refresh_token);
        }
        onPageLoad();
    }
    else {
        console.error(this.responseText);
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
function requestAuthorization(){
    let url = authorize;
    url += "?client_id=" + client_id;
    url += "&response_type=code";
    url += "&redirect_uri=" + encodeURI(redirect_uri);
    url += "&show_dialog=true";
    url += "&scope=user-follow-read user-read-private";
    //url += "&scope=user-follow-read user-read-private user-read-email user-modify-playback-state user-read-playback-position user-library-read streaming user-read-playback-state user-read-recently-played playlist-read-private";
    window.location.href = url; // Show Spotify's authorization screen
}

function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    location.reload();
}