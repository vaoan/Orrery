import { execFileSync } from "node:child_process";

export class GithubError extends Error {
  constructor(status, message, path) {
    super(`GitHub ${status} on ${path}: ${message}`);
    this.name = "GithubError";
    this.status = status;
  }
}

function defaultRunGh() {
  try {
    // `gh` is a real binary on every platform, not a .cmd shim, so no shell.
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8" });
  } catch {
    return "";
  }
}

export function resolveToken(env = process.env, runGh = defaultRunGh) {
  const token = env.ORRERY_GH_TOKEN || env.GITHUB_TOKEN || runGh().trim();
  if (!token) {
    throw new Error(
      "no GitHub token: set ORRERY_GH_TOKEN or GITHUB_TOKEN, or log in with gh so `gh auth token` works"
    );
  }
  return token;
}

export function createGithub({ token, fetchImpl = fetch, baseUrl = "https://api.github.com" }) {
  async function request(method, path, body) {
    const response = await fetchImpl(baseUrl + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 404) return { status: 404, data: null };
    if (response.status === 204) return { status: 204, data: null };

    if (response.status >= 400) {
      const text = await response.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed.message === "string" && parsed.message) {
          message = parsed.message;
        }
      } catch {
        // JSON parse failed, use raw text
      }
      message = message.trim().slice(0, 200);
      throw new GithubError(response.status, message, path);
    }

    return { status: response.status, data: await response.json() };
  }

  return { request };
}
