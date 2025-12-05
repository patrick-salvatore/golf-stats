defmodule GolfStatsServer.Repo.Migrations.CreateClubs do
  use Ecto.Migration

  def change do
    create table(:clubs) do
      add :name, :string
      add :type, :string

      timestamps(type: :utc_datetime)
    end
  end
end
