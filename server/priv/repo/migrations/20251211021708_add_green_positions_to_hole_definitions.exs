defmodule GolfStatsServer.Repo.Migrations.AddGreenPositionsToHoleDefinitions do
  use Ecto.Migration

  def change do
    alter table(:hole_definitions) do
      add(:front_lat, :float)
      add(:front_lng, :float)
      add(:back_lat, :float)
      add(:back_lng, :float)
    end
  end
end
