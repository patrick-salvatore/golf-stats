defmodule GolfStatsServer.Stats do
  @moduledoc """
  The Stats context.
  """

  import Ecto.Query, warn: false
  alias GolfStatsServer.Repo

  alias GolfStatsServer.Round
  alias GolfStatsServer.Hole

  @doc """
  Returns the list of rounds.
  """
  def list_rounds(user) do
    holes_query = from(h in Hole, order_by: h.hole_number)

    from(r in Round, where: r.user_id == ^user.id, order_by: [desc: r.date])
    |> Repo.all()
    |> Repo.preload(holes: holes_query)
  end

  @doc """
  Gets a single round.

  Raises `Ecto.NoResultsError` if the Round does not exist.

  ## Examples

      iex> get_round!(123)
      %Round{}

      iex> get_round!(456)
      ** (Ecto.NoResultsError)

  """
  def get_round!(id) do
    holes_query = from(h in Hole, order_by: h.hole_number)

    Round
    |> Repo.get!(id)
    |> Repo.preload(holes: holes_query)
  end

  @doc """
  Creates a round.

  ## Examples

      iex> create_round(%{field: value})
      {:ok, %Round{}}

      iex> create_round(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_round(user, attrs \\ %{}) do
    %Round{}
    |> Round.changeset(Map.put(attrs, "user_id", user.id))
    |> Repo.insert()
  end

  @doc """
  Updates a round.

  ## Examples

      iex> update_round(round, %{field: new_value})
      {:ok, %Round{}}

      iex> update_round(round, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_round(%Round{} = round, attrs) do
    round
    |> Round.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a round.

  ## Examples

      iex> delete_round(round)
      {:ok, %Round{}}

      iex> delete_round(round)
      {:error, %Ecto.Changeset{}}

  """
  def delete_round(%Round{} = round) do
    Repo.delete(round)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking round changes.

  ## Examples

      iex> change_round(round)
      %Ecto.Changeset{data: %Round{}}

  """
  def change_round(%Round{} = round, attrs \\ %{}) do
    Round.changeset(round, attrs)
  end

  @doc """
  Returns the list of holes.

  ## Examples

      iex> list_holes()
      [%Hole{}, ...]

  """
  def list_holes do
    Repo.all(Hole)
  end

  @doc """
  Gets a single hole.

  Raises `Ecto.NoResultsError` if the Hole does not exist.

  ## Examples

      iex> get_hole!(123)
      %Hole{}

      iex> get_hole!(456)
      ** (Ecto.NoResultsError)

  """
  def get_hole!(id), do: Repo.get!(Hole, id)

  @doc """
  Creates a hole.

  ## Examples

      iex> create_hole(%{field: value})
      {:ok, %Hole{}}

      iex> create_hole(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_hole(attrs \\ %{}) do
    %Hole{}
    |> Hole.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a hole.

  ## Examples

      iex> update_hole(hole, %{field: new_value})
      {:ok, %Hole{}}

      iex> update_hole(hole, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_hole(%Hole{} = hole, attrs) do
    hole
    |> Hole.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a hole.

  ## Examples

      iex> delete_hole(hole)
      {:ok, %Hole{}}

      iex> delete_hole(hole)
      {:error, %Ecto.Changeset{}}

  """
  def delete_hole(%Hole{} = hole) do
    Repo.delete(hole)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking hole changes.

  ## Examples

      iex> change_hole(hole)
      %Ecto.Changeset{data: %Hole{}}

  """
  def change_hole(%Hole{} = hole, attrs \\ %{}) do
    Hole.changeset(hole, attrs)
  end

  def get_dashboard_stats(user) do
    # Filter holes through rounds belonging to user
    holes =
      Repo.all(
        from(h in Hole, join: r in Round, on: h.round_id == r.id, where: r.user_id == ^user.id)
      )

    rounds = Repo.all(from(r in Round, where: r.user_id == ^user.id))

    avg_score =
      if Enum.empty?(rounds),
        do: 0,
        else: Float.round(Enum.sum(Enum.map(rounds, & &1.total_score)) / length(rounds), 1)

    par3s = Enum.filter(holes, &(&1.par == 3))

    avg_par3 =
      if Enum.empty?(par3s),
        do: 0,
        else: Float.round(Enum.sum(Enum.map(par3s, & &1.score)) / length(par3s), 1)

    par4s = Enum.filter(holes, &(&1.par == 4))

    avg_par4 =
      if Enum.empty?(par4s),
        do: 0,
        else: Float.round(Enum.sum(Enum.map(par4s, & &1.score)) / length(par4s), 1)

    par5s = Enum.filter(holes, &(&1.par == 5))

    avg_par5 =
      if Enum.empty?(par5s),
        do: 0,
        else: Float.round(Enum.sum(Enum.map(par5s, & &1.score)) / length(par5s), 1)

    # Fairways
    drives = Enum.filter(holes, & &1.fairway_status)
    fairways_total = length(drives)
    fairways_hit = Enum.count(drives, &(&1.fairway_status == "hit"))
    fairways_left = Enum.count(drives, &(&1.fairway_status == "left"))
    fairways_right = Enum.count(drives, &(&1.fairway_status == "right"))

    # GIR
    approaches = Enum.filter(holes, & &1.gir_status)
    gir_total = length(approaches)
    gir_hit = Enum.count(approaches, &(&1.gir_status == "hit"))

    # Proximity
    gir_shots = Enum.filter(approaches, &(&1.gir_status == "hit" and &1.proximity_to_hole))

    prox_buckets =
      Enum.reduce(
        gir_shots,
        %{"0-10" => 0, "10-15" => 0, "15-30" => 0, "30-45" => 0, "45+" => 0},
        fn h, acc ->
          dist = h.proximity_to_hole

          bucket =
            cond do
              dist <= 10 -> "0-10"
              dist <= 15 -> "10-15"
              dist <= 30 -> "15-30"
              dist <= 45 -> "30-45"
              true -> "45+"
            end

          Map.update!(acc, bucket, &(&1 + 1))
        end
      )

    # Putting
    total_holes_count = length(holes)
    three_putts = Enum.count(holes, &(&1.putts >= 3))

    putts_by_prox =
      Enum.reduce(
        gir_shots,
        %{
          "0-15" => {0, 0},
          "15-30" => {0, 0},
          "30-45" => {0, 0},
          "45+" => {0, 0}
        },
        fn h, acc ->
          dist = h.proximity_to_hole

          bucket =
            cond do
              dist < 15 -> "0-15"
              dist < 30 -> "15-30"
              dist < 45 -> "30-45"
              true -> "45+"
            end

          {putts, count} = Map.get(acc, bucket)
          Map.put(acc, bucket, {putts + h.putts, count + 1})
        end
      )

    # Format putting stats for JSON
    formatted_putts_by_prox =
      Enum.into(putts_by_prox, %{}, fn {k, {putts, count}} ->
        {k, %{putts: putts, count: count}}
      end)

    # Club Stats logic
    all_clubs = GolfStatsServer.Bag.list_clubs(user)
    # Create a map of club_id => club_name for lookup
    club_map = Enum.into(all_clubs, %{}, fn c -> {c.id, c.name} end)

    club_stats =
      holes
      |> Enum.flat_map(fn h ->
        # h.club_ids is a list of club IDs [driver_id, iron_id, putter_id]
        # We assume order matters:
        # 1. First club on Par 4/5 = Tee Shot (Fairway logic)
        # 2. Last non-putter club = Approach Shot (GIR logic) - simplified heuristic
        # 3. Putter = Putting (not tracking stats per putter usually)

        # But wait, we need to map the result of the hole (fairway_status, gir_status) to the specific club used.

        ids = h.club_ids || []

        # Filter out invalid IDs just in case
        valid_ids = Enum.filter(ids, &Map.has_key?(club_map, &1))

        # Tee Shot (if Par > 3 and has clubs)
        tee_shot =
          if h.par > 3 and length(valid_ids) > 0 do
            club_id = List.first(valid_ids)
            %{club_id: club_id, type: :tee, result: h.fairway_status}
          else
            nil
          end

        # Approach Shot
        # Heuristic: The shot BEFORE the first putt? Or just the last non-putter?
        # Let's assume the user enters clubs in order.
        # If GIR is tracked, we attribute it to the club used for the approach.
        # If GIR = hit, score = par or better, usually.
        # If we just take the last non-putter club, that's likely the approach club.
        # We need to know which clubs are putters. 
        # But we don't have club type here easily without querying.
        # Let's use the club_map or assume the last club in the list might be a putter if we look at types.
        # Actually, let's just assume the 2nd to last club is approach if the last is putter?
        # Better: Filter out known putters if we can.

        # For now, let's just collect all shots to aggregate usage first, 
        # and do simple attribution for Tee Shots on Par 4/5.

        # We can also track "Shots Hit" per club simply by counting occurrences.

        usage = Enum.map(valid_ids, fn id -> %{club_id: id, type: :usage} end)

        ([tee_shot] ++ usage)
        # remove nils
        |> Enum.filter(& &1)
      end)
      |> Enum.group_by(& &1.club_id)
      |> Enum.map(fn {club_id, events} ->
        name = Map.get(club_map, club_id, "Unknown")

        total_uses = Enum.count(events, &(&1.type == :usage))

        # Tee Stats
        tee_events = Enum.filter(events, &(&1.type == :tee and &1.result))
        tee_attempts = length(tee_events)
        tee_hits = Enum.count(tee_events, &(&1.result == "hit"))

        # Only return if meaningful
        if total_uses > 0 do
          %{
            id: club_id,
            name: name,
            usageCount: total_uses,
            fairwayData:
              if(tee_attempts > 0, do: %{attempts: tee_attempts, hits: tee_hits}, else: nil)
          }
        else
          nil
        end
      end)
      |> Enum.filter(& &1)
      |> Enum.sort_by(& &1.usageCount, :desc)

    %{
      avgScore: avg_score,
      avgPar3: avg_par3,
      avgPar4: avg_par4,
      avgPar5: avg_par5,
      fairways: %{
        total: fairways_total,
        hit: fairways_hit,
        missLeft: fairways_left,
        missRight: fairways_right
      },
      gir: %{
        total: gir_total,
        hit: gir_hit
      },
      approach: %{
        proximity: prox_buckets
      },
      putting: %{
        totalHoles: total_holes_count,
        threePutts: three_putts,
        puttsByProx: formatted_putts_by_prox
      },
      clubStats: club_stats
    }
  end
end
