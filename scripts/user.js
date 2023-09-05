/**
 * User class. Stores users settings and informations
 * @class
 * @param {Object} data - User data from Spotify API
**/

class User {
    constructor(data) {
        this.displayname = data.display_name;
        this.id = data.id;
        this.market = localStorage.getItem("marketplace");
        this.timespan = localStorage.getItem("timespan");
        if (this.market === null) {
            this.market = data.country;
        }
        this.image = data.images[0].url;
        if (this.image === null) {
            this.image = "../images/profilepic.png";
        }
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }

    get market() {
        return this._market;
    }

    set market(market) {
        this._market = market;
    }

    get timespan() {
        return this._timespan;
    }

    set timespan(timespan) {
        this._timespan = timespan;
    }

    getProfile() {
        return {
            id : this.id,
            displayname: this.displayname,
            image : this.image
        };
    }
}

export default User;