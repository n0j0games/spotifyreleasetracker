import { Method } from "./enums/method.enum.js";
import { SpotifyUrls } from "./enums/spotify-urls.enum.js";

/**
 * Spotify API
 * Serves as the base for the Spotify API
 * @class
 **/
class SpotifyAPI {
    constructor(client_id, redirect_uri, error_callback) {
        this.access_token = localStorage.getItem("access_token");
        this.client_id = client_id;
        this.redirect_uri = redirect_uri;
        this.show_api_calls = localStorage.getItem("show_api_calls");
        this.error_callback = function(status, msg) {
            error_callback(status, msg);
        }
    }

    get access_token() {
        return this._access_token;
    }

    set access_token(access_token) {
        this._access_token = access_token;
    }

    /**
     * Call to the spotify API
     * @param method rest method {@link Method}
     * @param url spotify url {@link SpotifyUrls}
     * @param param url parameter, can be null
     * @param true_callback callback method on successful call
     * @param error_callback_ callback
     * @param error_message
     * @param body
     * @param call_count
     */
    call(method, url, param, true_callback, error_callback_, error_message, body = null, call_count = 0) {
        let self = this;
        let xhr = new XMLHttpRequest();
        let url_ = url;
        if (param !== null) {
            url_ += param;
        }
        xhr.open(method, url_, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', 'Bearer ' + this.access_token);
        xhr.send(JSON.stringify(body));
        xhr.onload = function () {
            if (self.show_api_calls === "true")
                console.log("Called", method, url_, this.status)
            if (this.status === 200 || this.status === 201) {
                true_callback(this.response);
            } else if (this.status === 401) {
                refreshToken(self);
            } else if (this.status === 429) {
                if (call_count > 10) {
                    self.error_callback(this.status, "Timed out. Refresh the page or try again later!");
                } else {
                    console.log("Too many requests, waiting 1s")
                    setTimeout(function () {
                        self.call(method, url, param, true_callback, error_callback_, error_message, body, call_count + 1);
                    }, 1000);
                }
            } else {
                self.error_callback(this.status, `${error_message}; Error may caused by Spotify API: ${this.responseText}`);
            }
        }
    }

    /* AUTHORIZATION */

    handleRedirect(callback) {
        let code = getCode();
        if (code == null) {
            this.error_callback(404, "Unknown url parameter");
        } else {
            fetchAccessToken(this, code);
        }
        callback();
    }

    /* Authorize user to app */
    async requestAuthorization() {

        const codeVerifier = generateRandomString(64);
        const hashed = await sha256(codeVerifier)
        const codeChallenge = base64encode(hashed);

        window.localStorage.setItem("code_verifier", codeVerifier);
        const scope = "user-follow-read user-read-private playlist-read-private playlist-modify-public playlist-modify-private user-library-modify"
        const params = {
            response_type: 'code',
            client_id: this.client_id,
            scope,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
            redirect_uri: encodeURI(this.redirect_uri)
        }

        const authUrl = new URL(SpotifyUrls.AUTHORIZE);
        authUrl.search = new URLSearchParams(params).toString();
        return authUrl.toString();
    }

}

async function sha256(plain) {
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    return window.crypto.subtle.digest('SHA-256', data)
}

function base64encode(input) {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

function getCode() {
    let code = null;
    const queryString = window.location.search;
    if (queryString.length > 0) {
        const urlParams = new URLSearchParams(queryString);
        code = urlParams.get('code')
    }
    return code;
}

function fetchAccessToken(self, code) {
    const codeVerifier_ = localStorage.getItem('code_verifier');
    const body = new URLSearchParams({
        client_id: self.client_id,
        grant_type: 'authorization_code',
        code,
        redirect_uri: encodeURI(self.redirect_uri),
        code_verifier: codeVerifier_
    });
    callAuthorizationApi(self, body);
}

function refreshToken(self) {
    console.log("Refreshing Token")
    const refresh_token = localStorage.getItem("refresh_token");
    const body = new URLSearchParams({
        client_id: self.client_id,
        grant_type: 'refresh_token',
        refresh_token: refresh_token
    });
    callAuthorizationApi(self, body);
}

function callAuthorizationApi(self, body) {
    console.log("API", body.toString());
    let xhr = new XMLHttpRequest();
    xhr.open(Method.POST, SpotifyUrls.TOKEN, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.send(body);
    xhr.onload = function() {
        const event = this;
        handleAuthorizationResponse(event, self);
    };
}

function handleAuthorizationResponse(ev, self) {
    if (ev.status === 200) {
        let data = JSON.parse(ev.responseText);
        console.log("Auth", data);
        if (data.access_token !== undefined) {
            self.access_token = data.access_token;
            localStorage.setItem("access_token", data.access_token);
        }
        if (data.refresh_token !== undefined) {
            localStorage.setItem("refresh_token", data.refresh_token);
        }
        location.reload();
    } else {
        console.error(ev.responseText);
        self.error_callback(ev.status, ev.responseText)
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        //location.reload();
    }
}

export default SpotifyAPI;