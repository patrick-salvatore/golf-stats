defmodule GolfStatsServer.StatsLogic do
  alias GolfStatsServer.Repo
  alias GolfStatsServer.Stats.{Round, Hole}

  def get_dashboard_stats do
    holes = Repo.all(Hole)
    rounds = Repo.all(Round)

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
      }
    }
  end
end
