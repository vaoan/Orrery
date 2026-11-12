export class GithubError extends Error {
  constructor(status, message, path) {
    super(`GitHub ${status} on ${path}: ${message}`);
    this.name = "GithubError";
    this.status = status;
  }
}

export function resolveToken(env = process.env) {
  const token = env.THEMIS_GH_TOKEN || env.GITHUB_TOKEN || env.GH_TOKEN;
  if (!token) {
    throw new Error("no GitHub token: set THEMIS_GH_TOKEN, GITHUB_TOKEN or GH_TOKEN");
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
