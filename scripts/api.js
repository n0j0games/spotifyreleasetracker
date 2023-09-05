const urls = {
    authorize: 'https://accounts.spotify.com/authorize',
    token: 'https://accounts.spotify.com/api/token',
    followed_artists: 'https://api.spotify.com/v1/me/following?type=artist&limit=50',
    artist_profile: 'https://api.spotify.com/v1/artists/',
    search_artist: 'https://api.spotify.com/v1/search?type=artist&q=',
    user_profile: 'https://api.spotify.com/v1/me',
    album_tracks: 'https://api.spotify.com/v1/albums/',
}

/* Serves as the base for the Spotify API */
class SpotifyAPI {
    constructor(client_id, client_secret, redirect_uri, error_callback) {
      this.access_token = localStorage.getItem("access_token");
      this.refreshToken = null;
      this.client_id = client_id;
      this.client_secret = client_secret;
      this.redirect_uri = redirect_uri;
      this.error_callback = error_callback
      console.log("access_token", this.access_token, "refresh_token", this.refreshToken, this.client_id, this.client_secret, this.redirect_uri)
    }

    get access_token() {
      return this._access_token;
    }

    set access_token(access_token) {
      this._access_token = access_token;
    }

    /* Calls the API */
    call(method, url, body, true_callback, error_callback, error_message) {
      let xhr = new XMLHttpRequest();
      xhr.open(method, urls[url], true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.access_token);
      xhr.send(body);
      xhr.onerror = console.warn("XHR:", xhr);
      xhr.onload = function(){
        if (this.status == 200) {
          true_callback(this.response);
        } else if (this.status == 401) {
          refreshToken();
        } else {
          console.error(this.status, this.responseText);
          error_callback(true, this.status, error_message);
        }
      }
    }

    /* AUTHORIZATION */

    handleRedirect(callback) {
      let code = this.getCode();
      this.fetchAccessToken( code );
      callback();
    }

    fetchAccessToken( code ){
      let body = "grant_type=authorization_code";
      body += "&code=" + code;
      body += "&redirect_uri=" + encodeURI(this.redirect_uri);
      body += "&client_id=" + this.client_id;
      body += "&client_secret=" + this.client_secret;
      this.callAuthorizationApi(body);
    }

    refreshToken() {
      this.refresh_token = localStorage.getItem("refresh_token");
      let body = "grant_type=refresh_token";
      body += "&refresh_token=" + refresh_token;
      body += "&client_id=" + client_id;
      callAuthorizationApi(body);
    }

    callAuthorizationApi(body){
      let xhr = new XMLHttpRequest();
      xhr.open("POST", urls.token, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.setRequestHeader('Authorization', 'Basic ' + btoa(this.client_id + ":" + this.client_secret));
      xhr.send(body);
      xhr.onload = this.handleAuthorizationResponse;
    }

    handleAuthorizationResponse(){
      if ( this.status === 200 ){
          let data = JSON.parse(this.responseText);
          if ( data.access_token != undefined ){
              this.access_token = data.access_token;
              localStorage.setItem("access_token", data.access_token);
          }
          if ( data.refresh_token  != undefined ){
              this.refresh_token = data.refresh_token;
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

    getCode() {
      let code = null;
      const queryString = window.location.search;
      if ( queryString.length > 0 ){
          const urlParams = new URLSearchParams(queryString);
          code = urlParams.get('code')
      }
      return code;
    }

    /* Authorize user to app */
    requestAuthorization(callback) {
      let url = urls.authorize;
      url += "?client_id=" + this.client_id;
      url += "&response_type=code";
      url += "&redirect_uri=" + encodeURI(this.redirect_uri);
      url += "&show_dialog=true";
      url += "&scope=user-follow-read user-read-private";
      callback(url);
    }

}

export default SpotifyAPI;