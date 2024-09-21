import {Artist} from "./artist.model";
import {SavedPlaylist} from "./saved-playlist.model";
import {Playlist} from "./playlist.model";
import {ReleaseOrder} from "./release-order.enum";

/**
 *  User data saved in localstorage
 */
export class User {

  constructor(
    public artists: Artist[] | null,
    public market: string,
    public timespan: number,
    public advancedFilter: boolean,
    public notSaveDoubles: boolean,
    public activePlaylist?: string | null,
    public sorting?: ReleaseOrder,
    public savedPlaylists?: SavedPlaylist[],
    public releasePlaylists?: Playlist[]
  ) { }

}
