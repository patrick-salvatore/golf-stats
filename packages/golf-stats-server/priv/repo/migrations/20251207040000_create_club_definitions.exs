defmodule GolfStatsServer.Repo.Migrations.CreateClubDefinitions do
  use Ecto.Migration

  def change do
    create table(:club_definitions) do
      add :name, :string
      add :type, :string
      add :category, :string
      add :default_selected, :boolean, default: false
      add :sort_order, :integer

      timestamps(type: :utc_datetime)
    end

    create unique_index(:club_definitions, [:name])
  end
end
