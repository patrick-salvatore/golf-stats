defmodule GolfStatsServer.Stats.Hole do
  use Ecto.Schema
  import Ecto.Changeset

  schema "holes" do
    field(:hole_number, :integer)
    field(:par, :integer)
    field(:score, :integer)
    field(:fairway_hit, :boolean, default: false)
    field(:gir, :boolean, default: false)
    field(:putts, :integer)
    belongs_to(:round, GolfStatsServer.Stats.Round)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(hole, attrs) do
    hole
    |> cast(attrs, [:hole_number, :par, :score, :fairway_hit, :gir, :putts])
    |> validate_required([:hole_number, :par, :score, :fairway_hit, :gir, :putts])
  end
end
