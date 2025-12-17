defmodule GolfStatsServer.Repo.Migrations.AddTimestampsToRounds do
  use Ecto.Migration

  def change do
    alter table(:rounds) do
      add(:created_at, :utc_datetime)
      add(:ended_at, :utc_datetime)
    end
  end
end
