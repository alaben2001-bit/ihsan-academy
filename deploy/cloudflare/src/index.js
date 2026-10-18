import { Container, getContainer } from "@cloudflare/containers";

/**
 * Edge entrypoint for the isolated Ihsan Academy student-platform trial.
 * This Worker forwards the request unchanged to one stable container instance.
 * It does not touch the existing Pages school website or Render deployment.
 */
export class IhsanAcademyContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "10m";
}

export default {
  async fetch(request, env) {
    const instance = getContainer(env.IHSAN_CONTAINER, "ihsan-academy-trial");
    return instance.fetch(request);
  },
};
