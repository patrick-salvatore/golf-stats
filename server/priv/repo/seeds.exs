alias GolfStatsServer.Repo
alias GolfStatsServer.Stats.{Round, Hole}

# Clear existing data
Repo.delete_all(Hole)
Repo.delete_all(Round)

generate_holes = fn profile ->
  Enum.map(1..18, fn hole_num ->
    par = Enum.at([4, 5, 4, 3, 4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 5, 3, 4], hole_num - 1)

    # Logic based on profile
    {score, putts, fairway_status, gir_status, proximity, fw_bunker, gs_bunker} =
      case profile do
        :good ->
          # Consistent play
          gir = Enum.random([true, true, true, false])
          fw_status = if par > 3, do: Enum.random(["hit", "hit", "hit", "left"]), else: nil

          {score, putts, prox} =
            if gir do
              {par + Enum.random([-1, 0]), Enum.random([1, 2]), Enum.random(5..25)}
            else
              {par + Enum.random([0, 1]), Enum.random([1, 1, 2]), nil}
            end

          {score, putts, fw_status, if(gir, do: "hit", else: "short"), prox, false, false}

        :average ->
          # Mixed bag
          gir = Enum.random([true, false, false])
          fw_status = if par > 3, do: Enum.random(["hit", "left", "right"]), else: nil

          {score, putts, prox} =
            if gir do
              {par, 2, Enum.random(20..45)}
            else
              {par + Enum.random([1, 2]), Enum.random([2, 3]), nil}
            end

          {score, putts, fw_status, if(gir, do: "hit", else: "right"), prox,
           Enum.random([true, false]), Enum.random([true, false])}

        :scramble ->
          # Missed greens, good saves
          gir = false
          fw_status = if par > 3, do: Enum.random(["left", "right"]), else: nil
          putts = 1
          score = par + Enum.random([0, 1])

          {score, putts, fw_status, "short", nil, true, true}
      end

    %{
      hole_number: hole_num,
      par: par,
      score: score,
      putts: putts,
      fairway_status: fairway_status,
      gir_status: gir_status,
      proximity_to_hole: proximity,
      fairway_bunker: fw_bunker,
      greenside_bunker: gs_bunker,
      fairway_hit: fairway_status == "hit",
      gir: gir_status == "hit"
    }
  end)
end

# Round 1
date1 = ~D[2023-10-15]
holes1 = generate_holes.(:good)
total_score1 = Enum.reduce(holes1, 0, fn h, acc -> acc + h.score end)

%Round{}
|> Round.changeset(%{
  course_name: "Pebble Beach",
  date: date1,
  total_score: total_score1,
  created_at: DateTime.new!(date1, ~T[08:00:00]),
  ended_at: DateTime.new!(date1, ~T[12:30:00]),
  holes: holes1
})
|> Repo.insert!()

# Round 2
date2 = ~D[2023-10-22]
holes2 = generate_holes.(:average)
total_score2 = Enum.reduce(holes2, 0, fn h, acc -> acc + h.score end)

%Round{}
|> Round.changeset(%{
  course_name: "St Andrews",
  date: date2,
  total_score: total_score2,
  created_at: DateTime.new!(date2, ~T[09:00:00]),
  ended_at: DateTime.new!(date2, ~T[13:45:00]),
  holes: holes2
})
|> Repo.insert!()

# Round 3
date3 = ~D[2023-11-05]
holes3 = generate_holes.(:scramble)
total_score3 = Enum.reduce(holes3, 0, fn h, acc -> acc + h.score end)

%Round{}
|> Round.changeset(%{
  course_name: "Augusta National",
  date: date3,
  total_score: total_score3,
  created_at: DateTime.new!(date3, ~T[07:30:00]),
  ended_at: DateTime.new!(date3, ~T[11:30:00]),
  holes: holes3
})
|> Repo.insert!()

IO.puts("Seeded 3 rounds successfully!")
