import keys from "../apikey.js";
import SpotifyAPI from "./api.js";

const html = {
    authorize : document.getElementById("authorize"),
    app : document.getElementById("app"),
    artist_popup : document.getElementById("artistPopup"),
    settings_popup : document.getElementById("settingsPopup"),
    error_popup : {
        item : document.getElementById("error"),
        title : document.getElementById("errorTitle"),
        subtitle : document.getElementById("errorSubtitle"),
    },
    artistFG : document.getElementById("artistFG").innerHTML,
    releases : document.getElementById("releases").innerHTML,
    user_info : {
        item : document.getElementById("loginInfo"),
        logo : document.getElementById("loginImg"),
        name : document.getElementById("loginUser"),
        logout_button : document.getElementById("logoutBtn"),
        settings_button : document.getElementById("settingsBtn")
    }
}

class User {
    constructor(data) {
        this.displayname = data.display_name;
        this.id = data.id;
        this.market = data.country;
        this.image = data.images[0].url;
        this.updateUI();
    }

    get displayname() {
        return this._displayname;
    }
  
    set displayname(displayname) {
        this._displayname = displayname;
    }

    updateUI() {
        html.user_info.logo.src = this.image
        html.user_info.name.innerHTML = `Logged in as <p id="loginUserHighlight">${this.displayname}</p>`
        html.user_info.logout_button.style.display = 'block';
        html.user_info.settings_button.style.display = 'block';
    }
}

const api = new SpotifyAPI(keys.id, keys.secret, keys.uri, window.showError);

/* Main function, called on page load */
window.onPageLoad = function() {
    const location = window.location.href.split("?")[0];
    if (location !== keys.uri) {
        console.error("wrong uri", location, keys.uri);
        return;
    }

    html.app.style.display = "none";
    if ( window.location.search.length > 0 ) {
        api.handleRedirect( function() {window.history.pushState("", "", keys.uri);} );
    } else if ( api.access_token == null ) {
        // we don't have an access token so present token section
        html.authorize.style.display = 'flex';
        html.app.style.display = 'none';
    } else {
        html.app.style.display = 'block';
        html.authorize.style.display = 'none';
        api.call("GET", "user_profile", null, onLogin, showError)
    }
}

/* Called after successful login procedure */
function onLogin(response) {
    const data = JSON.parse(response)

    // TODO load settings

    let user = new User(data)
    console.log(`Logged in as ${user.displayname}`);

    // TODO

}

/* From "Connect with Spotify Button", request Authoriazation */
window.requestAuthorization = function() {
    api.requestAuthorization( function(url) {window.location.href = url;} );
}

/* Logs out the user */
window.logout = function () {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    location.reload();
}

/* Show messages */
window.showMessage = function(enable, title, subtitle) {
    message(enable, title, subtitle, "#777777")
}

/* Show error */
window.showError = function(enable, title, subtitle) {
    message(enable, `Something went wrong: Error ${title} (Try reload page)`, subtitle)
}

function message(enable, title, subtitle, color=null) {
    if (!enable) {
        html.error_popup.item.style.display = "none";
        return;
    }
    if (color !== null) {
        html.error_popup.item.style.background = color;
    }
    html.error_popup.item.style.display = "flex";
    html.error_popup.title.innerHTML = title
    html.error_popup.subtitle.innerHTML = subtitle;
}