import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import * as cors from "cors";
import {Request, Response} from "express";
import * as express from "express";
import * as graphqlHTTP from "express-graphql";
import * as session from "express-session";
import sharedsession = require("express-socket.io-session");
import * as fsx from "fs-extra";
import {buildSchema} from "graphql";
import {importSchema} from "graphql-import";
import * as http from "http";
import * as httpStatus from "http-status";
import * as path from "path";
import {Sequelize} from "sequelize-typescript";
import * as socketIo from "socket.io";
import {resolver} from "./graphql/resolvers";
import dataaccess from "./lib/dataaccess";
import globals from "./lib/globals";
import routes from "./routes";

const SequelizeStore = require("connect-session-sequelize")(session.Store);
const logger = globals.logger;

class App {
    public app: express.Application;
    public io: socketIo.Server;
    public server: http.Server;
    public readonly sequelize: Sequelize;

    constructor() {
        this.app = express();
        this.server = new http.Server(this.app);
        this.io = socketIo(this.server);
        this.sequelize = new Sequelize(globals.config.database.connectionUri );
    }

    /**
     * initializes everything that needs to be initialized asynchronous.
     */
    public async init() {
        await dataaccess.init(this.sequelize);

        const appSession = session({
            cookie: {
                maxAge: Number(globals.config.session.cookieMaxAge) || 604800000,
                secure: "auto",
            },
            resave: false,
            saveUninitialized: false,
            secret: globals.config.session.secret,
            store: new SequelizeStore({db: this.sequelize}),
        });

        const force = fsx.existsSync("sqz-force");
        logger.info(`Sequelize Table force: ${force}`);
        await this.sequelize.sync({force, logging: (msg) => logger.silly(msg)});
        await routes.ioListeners(this.io);

        this.io.use(sharedsession(appSession, {autoSave: true}));

        this.app.set("views", path.join(__dirname, "views"));
        this.app.set("view engine", "pug");
        this.app.set("trust proxy", 1);

        this.app.use(compression());
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended: false}));
        this.app.use(express.static(path.join(__dirname, "public")));
        this.app.use(cookieParser());
        this.app.use(appSession);
        if (globals.config.server.cors) {
            this.app.use(cors());
        }
        this.app.use((req, res, next) => {
            logger.verbose(`${req.method} ${req.url}`);
            next();
        });
        this.app.use(routes.router);
        this.app.use("/graphql",  graphqlHTTP((request, response) => {
            return {
                // @ts-ignore all
                context: {session: request.session},
                graphiql: true,
                rootValue: resolver(request, response),
                schema: buildSchema(importSchema(path.join(__dirname, "./graphql/schema.graphql"))),
            };
        }));
        this.app.use((req: any, res: Response) => {
            if (globals.config.frontend.angularIndex) {
                res.sendFile(path.join(__dirname, globals.config.frontend.angularIndex));
            } else {
                res.status(httpStatus.NOT_FOUND);
                res.render("errors/404.pug", {url: req.url});
            }
        });
        this.app.use((err, req: Request, res: Response) => {
            res.status(httpStatus.INTERNAL_SERVER_ERROR);
            res.render("errors/500.pug");
        });
    }

    /**
     * Starts the web server.
     */
    public start() {
        if (globals.config.server.port) {
            logger.info(`Starting server...`);
            this.app.listen(globals.config.server.port);
            logger.info(`Server running on port ${globals.config.server.port}`);
        } else {
            logger.error("No port specified in the config." +
                "Please configure a port in the config.yaml.");
        }
    }
}

export default App;
