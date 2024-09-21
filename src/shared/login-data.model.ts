/**
 * Representing Userdata loaded by Spotify
 */
export class LoginData {

  constructor(
    public id : string,
    public display_name : string,
    public images : { url : string }[],
    public country : string
  ) { }

}
