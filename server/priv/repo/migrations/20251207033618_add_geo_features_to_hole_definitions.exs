defmodule GolfStatsServer.Repo.Migrations.AddGeoFeaturesToHoleDefinitions do
  use Ecto.Migration

  def change do
    alter table(:hole_definitions) do
      add(:geo_features, :map)
    end
  end
end
