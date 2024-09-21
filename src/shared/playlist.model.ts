/**
 *  Saved playlist
 */
export class Playlist {
  constructor(
    public id: string,
    public image: string,
    public name: string,
    public owner: string,
    public added: boolean
  ) {}
}
