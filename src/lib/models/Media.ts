import * as fsx from "fs-extra";
import * as sqz from "sequelize";
import {BeforeDestroy, Column, HasOne, Model, NotNull, Table} from "sequelize-typescript";
import {MediaType} from "../UploadManager";
import {Group} from "./Group";
import {Post} from "./Post";
import {User} from "./User";

@Table({underscored: true})
export class Media extends Model<Media> {

    /**
     * Deletes the media file before the media is destroyed
     * @param instance
     */
    @BeforeDestroy
    public static deleteMediaFile(instance: Media) {
        fsx.unlinkSync(instance.path);
    }

    /**
     * The api url for the media
     */
    @NotNull
    @Column({type: sqz.STRING(512), allowNull: false})
    public url: string;

    /**
     * The local path of the file
     */
    @NotNull
    @Column({allowNull: false})
    public path: string;

    /**
     * The type of media
     */
    @Column({type: sqz.ENUM, values: ["IMAGE", "VIDEO"]})
    public type: MediaType;

    /**
     * The user that uses the media
     */
    @HasOne(() => User)
    public user: User;

    /**
     * The group that uses the media
     */
    @HasOne(() => Group)
    public group: Group;

    /**
     * The post that uses the media
     */
    @HasOne(() => Post)
    public post: Post;
}
