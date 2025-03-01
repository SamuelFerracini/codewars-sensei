import axios, { AxiosInstance } from "axios";
import * as tough from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import * as cheerio from "cheerio";

class CodewarsApiClient {
  private client: AxiosInstance;
  private jar: tough.CookieJar;
  private csrfToken: string | null = null;
  private baseURL: string;
  private authToken: string | null = null;
  private cookie: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.jar = new tough.CookieJar();
    this.client = wrapper(
      axios.create({
        baseURL,
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      })
    );
  }

  setCookies(cookieString: string): void {
    this.client.defaults.headers["Cookie"] = cookieString;
    this.client.defaults.headers["cookie"] = cookieString;
    this.cookie = cookieString;
    console.log("✅ Cookies set successfully.");
  }

  setCsrfToken(csrfToken: string): void {
    this.csrfToken = csrfToken;
    this.client.defaults.headers["X-CSRF-Token"] = csrfToken;
    console.log("✅ CSRF Token set successfully.");
  }

  setAuthToken(authToken: string): void {
    this.authToken = authToken;
    this.client.defaults.headers["Authorization"] = `${authToken}`;
    console.log("✅ Auth Token set successfully.");
  }

  async login(email: string, password: string): Promise<boolean> {
    try {
      const loginPage = await this.client.get("/users/sign_in");
      const authenticityToken = loginPage.data.match(
        /name="authenticity_token" value="(.+?)"/
      )?.[1];

      if (!authenticityToken) {
        throw new Error("Failed to extract authenticity token.");
      }

      const response = await this.client.post(
        "/users/sign_in",
        new URLSearchParams({
          utf8: "✓",
          authenticity_token: authenticityToken,
          "user[email]": email,
          "user[password]": password,
          commit: "Sign in",
        }),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );

      if (response.status === 200) {
        const rawCookies = response.headers["set-cookie"] || [];
        const cookieString = rawCookies
          .map((cookie) => cookie.split(";")[0])
          .join("; ");

        const cookies = this.parseCookieString(cookieString);
        this.csrfToken = cookies["csrf-token"] || null;
        this.authToken = cookies["authorization"] || null;

        this.setCookies(cookieString);

        if (this.csrfToken) this.setCsrfToken(this.csrfToken);
        if (this.authToken) this.setAuthToken(this.authToken);

        return true;
      }
    } catch (error: any) {
      console.error(
        "🚨 Error:",
        error.response ? error.response.data : error.message
      );
    }
    return false;
  }

  async fetchRandomKataIds(language: string): Promise<string[]> {
    try {
      const url = `/kata/search/${language}`;
      const response = await this.client.get(url, {
        params: {
          xids: "completed",
          beta: "false",
          order_by: "sort_date desc",
          sample: "true",
        },
      });

      const $ = cheerio.load(response.data);
      return $(".list-item-kata[id]")
        .map((_, el) => $(el).attr("id"))
        .get();
    } catch (error: any) {
      console.error("🚨 Error fetching kata IDs:", error.message);
      return [];
    }
  }

  async fetchKataData(id: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/v1/code-challenges/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`🚨 Error fetching kata data for ID ${id}:`, error.message);
      return null;
    }
  }

  async fetchKataLinks(id: string, language: string) {
    try {
      const url = `/kata/${id}/train/${language}`;
      const response = await this.client.get(url);
      const html = response.data;

      const match = html.match(/\/kata\/projects\/([a-f0-9]+)\//);

      let prjId = null;
      let user = null;

      if (match && match[1]) {
        prjId = match[1];
      }

      const regex = /JSON.parse\(.+\);/gim;

      // Below this line only god understands
      const match2 = html.match(regex);

      function sanitizeJSON(jsonString: string) {
        try {
          jsonString = jsonString.trim().slice(1, -2);

          return JSON.stringify(JSON.parse(jsonString));
        } catch (error) {
          console.error("Invalid JSON string", error);
          return null;
        }
      }

      if (match2[0]) {
        const test = match2[0].match(/\(.+\);/gim);
        const test2 = sanitizeJSON(test[0]);
        if (test2) {
          const test3 = JSON.parse(test2);
          user = JSON.parse(test3);
        }
      }

      return [prjId, user];
    } catch (error) {
      return [];
    }
  }

  async fetchKataSolution(id: string, language: string): Promise<any> {
    try {
      const response = await this.client.post(
        `/kata/projects/${id}/${language}/session`,
        {},
        {
          headers: {
            accept: "application/json, text/plain, */*",
            "x-requested-with": "XMLHttpRequest",
          },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error(
        `🚨 Error fetching kata solution for ID ${id}:`,
        error.message
      );
      return null;
    }
  }

  private parseCookieString(cookieString: string): Record<string, string> {
    return Object.fromEntries(
      cookieString.split("; ").map((pair) => {
        const [key, value] = pair.split("=");
        return [key.toLowerCase(), decodeURIComponent(value)];
      })
    );
  }
}

export default new CodewarsApiClient("https://www.codewars.com");
