/**
 * Pantry API
 * @class
**/

const urls = {
    pantry: 'https://getpantry.cloud/apiv1/pantry/4a3c98e3-37dc-4f4b-badd-9f9fd0e5caa9/basket/'
}

class PantryAPI {
    constructor(error_callback) {
      this.error_callback = error_callback;
      this.show_api_calls = localStorage.getItem("show_api_calls");
    }

    call(method, param, true_callback, error_callback, error_message, body = null) {
      let self = this;
      let xhr = new XMLHttpRequest();
      let url = urls.pantry + param;
      xhr.open(method, url);
      xhr.setRequestHeader("Content-Type", "application/json");
      if (method === "DELETE" || method === "GET") {
        xhr.send();
      } else {
        xhr.send(JSON.stringify(body));
      }
      xhr.onload = function() {
        if (self.show_api_calls === "true")
          console.log("Called", method, url, this.status)
        if (this.status == 200) {
          if (true_callback !== null) {
            true_callback(this.response);
          }
        } else if (this.status == 400) {
          if (true_callback !== null) {
            true_callback(null);
          }
        } else {
          error_callback(this.status, `${error_message}; Error may caused by Pantry API: ${this.responseText}` );
        }
      }
    }
}

export default PantryAPI;