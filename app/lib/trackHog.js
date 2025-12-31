import TransportStream from "winston-transport";
import { PostHog } from "posthog-node";
import serverConfig from "../../config/server.config.js";

const { POST_HOG_API_KEY, POST_HOG_HOST } = serverConfig;

const postHogClient = new PostHog(POST_HOG_API_KEY, { host: POST_HOG_HOST });

function createPostHogTransport() {
  class PostHogTransport extends TransportStream {
    log(info, callback) {
      setImmediate(() => this.emit("logged", info));

      const properties = {
        level: info.level,
        message: info.message,
        timestamp: info.timestamp,
        stack: info.stack,
        requestId: info.requestId,
      };

      if (info.level === "error") {
        postHogClient.captureException(info?.error, info.requestId, properties);
      } else if (info.level === "warn") {
        const error = new Error(info.message);
        error.name = "Warning";
        postHogClient.captureException(error, info.requestId, properties);
      }
      callback();
    }

    close() {
      return postHogClient.shutdown();
    }
  }

  return new PostHogTransport();
}

export { postHogClient, createPostHogTransport };
