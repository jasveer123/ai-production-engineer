import GithubLogo from "@/assets/svg/github.svg"
import SlackLogo from "@/assets/svg/slack.svg"
import { Button } from "@/components/ui"
import { apiUrl } from "@/lib/api"
import { OAUTH_PROVIDER, OAUTH_PROVIDER_LABEL, type OAuthProvider } from "@/lib/constants/auth"
import { OAUTH_ENDPOINT, OAUTH_PROVIDERS } from "../constants"
import { useProviders } from "../hooks"

const LOGOS = {
  [OAUTH_PROVIDER.GITHUB]: GithubLogo,
  [OAUTH_PROVIDER.SLACK]: SlackLogo,
} as const

interface SocialAuthButtonsProps {
  verb: string
}

interface SocialButtonProps extends SocialAuthButtonsProps {
  provider: OAuthProvider
  enabled: boolean
}

function SocialButton({ provider, verb, enabled }: SocialButtonProps) {
  const Logo = LOGOS[provider]
  const label = `${verb} with ${OAUTH_PROVIDER_LABEL[provider]}`

  if (!enabled) {
    return (
      <Button variant="outline" className="w-full" type="button" disabled>
        <Logo className="size-4" />
        {label}
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      className="w-full"
      nativeButton={false}
      render={<a href={apiUrl(OAUTH_ENDPOINT[provider])} />}
    >
      <Logo className="size-4" />
      {label}
    </Button>
  )
}

export function SocialAuthButtons({ verb }: SocialAuthButtonsProps) {
  const { data: providers } = useProviders()
  const unavailable = OAUTH_PROVIDERS.filter((provider) => providers && !providers[provider])

  return (
    <div className="grid gap-3">
      {OAUTH_PROVIDERS.map((provider) => (
        <SocialButton
          key={provider}
          provider={provider}
          verb={verb}
          enabled={Boolean(providers?.[provider])}
        />
      ))}
      {unavailable.length > 0 && (
        <p className="text-center text-[0.8125rem] text-muted-foreground">
          {unavailable.map((p) => OAUTH_PROVIDER_LABEL[p]).join(" and ")} sign-in is off until the
          server has its client keys.
        </p>
      )}
    </div>
  )
}
