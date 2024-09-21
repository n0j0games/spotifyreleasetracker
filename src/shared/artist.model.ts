/**
 * Saved artist
 */
export class Artist {

  constructor(
    public id: string,
    public image: string,
    public name: string,
    public active: boolean,
    public added: boolean,
    public followed: boolean
  ) {}

}
