defmodule GolfStatsServer.Hole do
  use Ecto.Schema
  import Ecto.Changeset

  schema "holes" do
    field(:hole_number, :integer)
    field(:par, :integer)
    field(:score, :integer)
    # Deprecated in favor of fairway_status but kept for now
    field(:fairway_hit, :boolean, default: false)
    # Deprecated in favor of gir_status but kept for now
    field(:gir, :boolean, default: false)
    field(:putts, :integer)

    field(:fairway_status, :string)
    field(:gir_status, :string)
    field(:fairway_bunker, :boolean, default: false)
    field(:greenside_bunker, :boolean, default: false)
    field(:proximity_to_hole, :integer)
    field(:club_ids, {:array, :integer}, default: [])

    belongs_to(:round, GolfStatsServer.Round)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(hole, attrs) do
    hole
    |> cast(attrs, [
      :hole_number,
      :par,
      :score,
      :fairway_hit,
      :gir,
      :putts,
      :fairway_status,
      :gir_status,
      :fairway_bunker,
      :greenside_bunker,
      :proximity_to_hole,
      :club_ids
    ])
    |> validate_required([:hole_number, :par, :score, :putts])
  end
end
