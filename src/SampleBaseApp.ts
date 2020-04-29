/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Config, Id64String } from "@bentley/bentleyjs-core";
import { BrowserAuthorizationClientConfiguration, BrowserAuthorizationClient, BrowserAuthorizationCallbackHandler } from "@bentley/frontend-authorization-client";
import { UrlDiscoveryClient } from "@bentley/itwin-client";
import { IModelApp, FrontendRequestContext, IModelAppOptions, IModelConnection, TileAdmin } from "@bentley/imodeljs-frontend";
import { BentleyCloudRpcManager, BentleyCloudRpcParams, IModelReadRpcInterface, IModelTileRpcInterface } from "@bentley/imodeljs-common";
import { PresentationRpcInterface } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { UiComponents } from "@bentley/ui-components";
import { UiCore } from "@bentley/ui-core";

// Boiler plate code
export interface SampleContext {
  imodel: IModelConnection;
  viewDefinitionId: Id64String;
}

export class SampleBaseApp {
  public static get oidcClient() { return IModelApp.authorizationClient as BrowserAuthorizationClient; }

  public static async startup(optsIn?: IModelAppOptions) {

    let opts: IModelAppOptions = {};
    if (optsIn)
      opts = optsIn;

    opts.tileAdmin = TileAdmin.create({ useProjectExtents: false });

    await IModelApp.startup(opts);

    // initialize OIDC
    await SampleBaseApp.initializeOidc();

    // contains various initialization promises which need
    // to be fulfilled before the app is ready
    const initPromises = new Array<Promise<any>>();

    // initialize RPC communication
    initPromises.push(SampleBaseApp.initializeRpc());

    // initialize UiCore
    // initPromises.push(UiCore.initialize(IModelApp.i18n));

    // initialize UiComponents
    initPromises.push(UiComponents.initialize(IModelApp.i18n));

    // initialize Presentation
    initPromises.push(Presentation.initialize({
      activeLocale: IModelApp.i18n.languageList()[0],
    }));

    // the app is ready when all initialization promises are fulfilled
    await Promise.all(initPromises);
  }

  private static async initializeRpc(): Promise<void> {
    const rpcInterfaces = [IModelReadRpcInterface, IModelTileRpcInterface, PresentationRpcInterface];

    // initialize RPC for web apps
    let rpcParams: BentleyCloudRpcParams;

    const urlClient = new UrlDiscoveryClient();
    const requestContext = new FrontendRequestContext();
    const orchestratorUrl = await urlClient.discoverUrl(requestContext, "iModelJsOrchestrator.K8S", undefined);
    rpcParams = { info: { title: "general-purpose-imodeljs-backend", version: "v2.0" }, uriPrefix: orchestratorUrl };

    BentleyCloudRpcManager.initializeClient(rpcParams, rpcInterfaces);
  }

  private static async initializeOidc() {
    // Gather configuration out of the environment
    const clientId = Config.App.get("imjs_frontend_sample_client_id", "imodeljs-spa-samples-2686");
    const redirectUri = Config.App.get("imjs_frontend_sample_redirect_uri", "http://localhost:3000/signin-callback.html");
    const scope = Config.App.get("imjs_frontend_sample_scope", "openid email profile organization imodelhub context-registry-service:read-only product-settings-service general-purpose-imodeljs-backend imodeljs-router");
    const responseType = "code";
    const oidcConfig: BrowserAuthorizationClientConfiguration = { clientId, redirectUri, scope, responseType };

    await BrowserAuthorizationCallbackHandler.handleSigninCallback(oidcConfig.redirectUri);

    // Setup the IModelApp authorization client
    IModelApp.authorizationClient = new BrowserAuthorizationClient(oidcConfig);
  }
}
