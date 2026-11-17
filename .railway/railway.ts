import { defineRailway, preserve, project, service } from "railway/iac";

export const partial = "cozy-health-dashboard";

export default defineRailway((context) => {
  if (context.projectId !== "33f9a938-49e3-42c5-83c7-633ee85760fa" || context.environmentId !== "9ffd3fd1-ae52-4cc7-903e-35b529a151ae") {
    throw new Error("The reviewed CozyHealth production environment is required.");
  }

  const application = service("v0-provider-dashboard-component", {
    env: {
      "ADMIN_API_URL": preserve(),
      "ADMIN_DASHBOARD_ORIGIN": preserve(),
      "ADMIN_SESSION_SECRET": preserve(),
      "COZY_DEPLOYMENT_ENV": preserve(),
      "NEXT_PUBLIC_API_URL": preserve(),
      "NODE_ENV": preserve(),
      "PROVIDER_API_URL": preserve(),
      "PROVIDER_DASHBOARD_ORIGIN": preserve(),
      "PROVIDER_SESSION_SECRET": preserve(),
    },
    "source": {
        "branch": "main",
        "checkSuites": true,
        "repo": "cozy-health/v0-provider-dashboard-component",
        "type": "github"
      },
      "build": {
        "buildEnvironment": "V3",
        "builder": "RAILPACK"
      },
      "deploy": {
        "ipv6EgressEnabled": false,
        "multiRegionConfig": {
          "sfo": {
            "numReplicas": 1
          }
        },
        "runtime": "V2",
        "useLegacyStacker": false,
        "startCommand": "npm start",
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 3
      },
      "networking": {
        "customDomains": {
          "dashboard.cozyhealth.org": {
            "port": 3000
          }
        },
        "serviceDomains": {
          "v0-provider-dashboard-component-production-a35e.up.railway.app": {
            "port": 3000
          }
        }
      }
  });

  return project("celebrated-flexibility", { resources: [application] });
});
