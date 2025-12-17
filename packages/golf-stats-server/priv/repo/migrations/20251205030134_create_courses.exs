defmodule GolfStatsServer.Repo.Migrations.CreateCourses do
  use Ecto.Migration

  def change do
    create table(:courses) do
      add :name, :string
      add :city, :string
      add :state, :string
      add :lat, :float
      add :lng, :float

      timestamps(type: :utc_datetime)
    end
  end
end
