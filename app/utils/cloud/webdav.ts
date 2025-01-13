import { STORAGE_KEY } from "@/app/constant";
import { SyncStore } from "@/app/store/sync";

export type WebDAVConfig = SyncStore["webdav"];
export type WebDavClient = ReturnType<typeof createWebDavClient>;

export function createWebDavClient(store: SyncStore) {
  const folder = STORAGE_KEY;
  const fileName = `${folder}/backup.json`;
  const config = store.webdav;
  const useProxy = store.useProxy && store.proxyUrl.length > 0;
  const pathPrefix = "/api/webdav";
  const [webdavUrl, proxyUrl] = [config.endpoint, store.proxyUrl].map((url) =>
    url.endsWith("/") ? url.slice(0, -1) : url,
  );

  return {
    async check() {
      try {
        const res = await this.webdavFetch(folder, {
          webdavMethod: "MKCOL",
          httpMethod: "GET",
        });
        const success = [201, 200, 404, 405, 301, 302, 307, 308].includes(
          res.status,
        );
        console.log(
          `[WebDav] check ${success ? "success" : "failed"}, ${res.status} ${
            res.statusText
          }`,
        );
        return success;
      } catch (e) {
        console.error("[WebDav] failed to check", e);
      }

      return false;
    },

    async get(key: string) {
      const res = await this.webdavFetch(fileName, {
        webdavMethod: "GET",
      });

      console.log("[WebDav] get key = ", key, res.status, res.statusText);

      if (404 == res.status) {
        return "";
      }

      return await res.text();
    },

    async set(key: string, value: string) {
      const res = await this.webdavFetch(fileName, {
        webdavMethod: "PUT",
        body: value,
      });

      console.log("[WebDav] set key = ", key, res.status, res.statusText);
    },

    headers() {
      const auth = btoa(config.username + ":" + config.password);

      return {
        authorization: `Basic ${auth}`,
      };
    },

    webdavFetch(
      input: string,
      init: Omit<RequestInit, "method"> & {
        httpMethod?: string;
        webdavMethod: string;
      },
    ) {
      const path = !input.startsWith("/") ? `/${input}` : input;
      const { webdavMethod, httpMethod, ...options } = init;

      let method;
      let url;
      if (useProxy) {
        method = httpMethod ?? webdavMethod;

        try {
          const u = new URL(proxyUrl + pathPrefix + path);
          u.searchParams.append("endpoint", webdavUrl);
          webdavMethod && u.searchParams.append("proxy_method", webdavMethod);
          url = u.toString();
        } catch (e) {
          url = pathPrefix + path + "?endpoint=" + webdavUrl;
          if (webdavMethod) {
            url += "&proxy_method=" + webdavMethod;
          }
        }
      } else {
        method = webdavMethod;

        try {
          let u = new URL(webdavUrl + path);
          url = u.toString();
        } catch (e) {
          url = webdavUrl + path;
        }
      }

      return fetch(url, {
        ...options,
        method,
        headers: this.headers(),
      });
    },
  };
}
