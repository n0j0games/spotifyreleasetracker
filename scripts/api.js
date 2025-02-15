/**
 * Spotify API
 * @class
**/

const urls = {
    authorize: 'https://accounts.spotify.com/authorize',
    token: 'https://accounts.spotify.com/api/token',
    followed_artists: 'https://api.spotify.com/v1/me/following?type=artist&limit=50',
    artist_profile: 'https://api.spotify.com/v1/artists/',
    search_artist: 'https://api.spotify.com/v1/search?type=artist&q=',
    search_playlist: 'https://api.spotify.com/v1/search?type=playlist&q=',
    user_profile: 'https://api.spotify.com/v1/me',
    album_tracks: 'https://api.spotify.com/v1/albums/',
    artist: 'https://api.spotify.com/v1/artists/',
    playlists : 'https://api.spotify.com/v1/me/playlists?limit=50',
    save_to_library: 'https://api.spotify.com/v1/me/tracks',
    add_to_playlist: 'https://api.spotify.com/v1/playlists/',
    playlist: 'https://api.spotify.com/v1/playlists/',
}


/*
    API
 */

/* Serves as the base for the Spotify API */
class SpotifyAPI {
    constructor(client_id, redirect_uri) {
      this.access_token = localStorage.getItem("access_token");
      this.client_id = client_id;
      this.redirect_uri = redirect_uri;
      this.show_api_calls = localStorage.getItem("show_api_calls");
    }

    get access_token() {
      return this._access_token;
    }

    set access_token(access_token) {
      this._access_token = access_token;
    }

    /* Calls the API */
    call(method, url, param, true_callback, error_callback, error_message, body = null, call_count=0) {      
      let self = this;
      let xhr = new XMLHttpRequest();      
      let url_ = urls[url];
      if (url_ === undefined) {
        console.error("Wrong url", url, urls);
        return;      
      }
      if (param !== null) {
        url_ += param;
      }
      xhr.open(method, url_, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.access_token);
      xhr.send(JSON.stringify(body));
      //xhr.onerror = console.warn("XHR:", xhr);
      xhr.onload = function() {
        if (self.show_api_calls === "true")
          console.log("Called", method, url_, this.status)
        if (this.status === 200 || this.status === 201) {
          true_callback(this.response);
        } else if (this.status === 401) {
          console.log(self)
          refreshToken(self);
        } else if (this.status === 429) {
          if (call_count > 10) {
            error_callback(this.status, "Timed out. Refresh the page or try again later!");
          } else {
            console.log("Too many requests, waiting 1s")
            setTimeout(function() {
              self.call(method, url, param, true_callback, error_callback, error_message, body, call_count+1);
            }, 5000);
          }          
        } else {
          error_callback(this.status, `${error_message}; Error may caused by Spotify API: ${this.responseText}` );
        }
      }
    }

    /* AUTHORIZATION */

    handleRedirect(callback) {
      let code = getCode();
      this.fetchAccessToken( code );
      callback();
    }

    fetchAccessToken( code ){
        const codeVerifier_ = localStorage.getItem('code_verifier');
        const body = new URLSearchParams({
            client_id: this.client_id,
            grant_type: 'authorization_code',
            code,
            redirect_uri: encodeURI(this.redirect_uri),
            code_verifier: codeVerifier_
        });
      this.callAuthorizationApi(body);
    }

    callAuthorizationApi(body){
      let xhr = new XMLHttpRequest();
      xhr.open("POST", urls.token, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.send(body);
      xhr.onload = this.handleAuthorizationResponse;
    }

    handleAuthorizationResponse(){
      if ( this.status === 200 ){
          let data = JSON.parse(this.responseText);
          if ( data.access_token !== undefined ){
              this.access_token = data.access_token;
              localStorage.setItem("access_token", data.access_token);
          }
          if ( data.refresh_token  !== undefined ){
              localStorage.setItem("refresh_token", data.refresh_token);
          }
          location.reload();
      }
      else {
          console.error(this.responseText);
          //TODO this.error_callback(true, this.status, this.error_message);
          //TODO add here logout();
      }
    }

    
    /* Authorize user to app */
    async requestAuthorization() {

        const codeVerifier  = generateRandomString(64);
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

        const authUrl = new URL(urls.authorize);
        authUrl.search = new URLSearchParams(params).toString();
        return authUrl.toString();
    }

}

async function sha256(plain){
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    return window.crypto.subtle.digest('SHA-256', data)
}

function base64encode(input){
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
  if ( queryString.length > 0 ){
      const urlParams = new URLSearchParams(queryString);
      code = urlParams.get('code')
  }
  return code;
}

function refreshToken(self) {
  console.log("Refreshing Token")
  let refresh_token = localStorage.getItem("refresh_token");
  let body = "grant_type=refresh_token";
  body += "&refresh_token=" + refresh_token;
  body += "&client_id=" + self.client_id;
  self.callAuthorizationApi(body);
}

export default SpotifyAPI;