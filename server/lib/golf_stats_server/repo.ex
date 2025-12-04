defmodule GolfStatsServer.Repo do
  use Ecto.Repo,
    otp_app: :golf_stats_server,
    adapter: Ecto.Adapters.SQLite3
end
