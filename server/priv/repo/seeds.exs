alias GolfStatsServer.Repo
alias GolfStatsServer.{Round, Hole}
alias GolfStatsServer.Bag.Club
alias GolfStatsServer.Accounts.User

# Clear existing data
Repo.delete_all(Hole)
Repo.delete_all(Round)
Repo.delete_all(Club)
Repo.delete_all(User)

# Create Default User
{:ok, user} = Repo.insert(%User{username: "demo"})
{:ok, user2} = Repo.insert(%User{username: "demo2"})

# Create Clubs
clubs_data = [
  {"Driver", "driver"},
  {"3 Wood", "wood"},
  {"5 Wood", "wood"},
  {"3 Hybrid", "hybrid"},
  {"4 Iron", "iron"},
  {"5 Iron", "iron"},
  {"6 Iron", "iron"},
  {"7 Iron", "iron"},
  {"8 Iron", "iron"},
  {"9 Iron", "iron"},
  {"Pitching Wedge", "wedge"},
  {"Gap Wedge", "wedge"},
  {"Sand Wedge", "wedge"},
  {"Lob Wedge", "wedge"},
  {"Putter", "putter"}
]

clubs =
  Enum.map(clubs_data, fn {name, type} ->
    %Club{}
    |> Club.changeset(%{name: name, type: type, user_id: user.id})
    |> Repo.insert!()
  end)

clubs =
  Enum.map(clubs_data, fn {name, type} ->
    %Club{}
    |> Club.changeset(%{name: name, type: type, user_id: user2.id})
    |> Repo.insert!()
  end)

# Create a map for easy lookup by type or name to simulate realistic usage
driver = Enum.find(clubs, &(&1.type == "driver"))
woods = Enum.filter(clubs, &(&1.type == "wood"))
hybrids = Enum.filter(clubs, &(&1.type == "hybrid"))
irons = Enum.filter(clubs, &(&1.type == "iron"))
wedges = Enum.filter(clubs, &(&1.type == "wedge"))
putter = Enum.find(clubs, &(&1.type == "putter"))

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
          fw_status = if par > 3, do: Enum.random(["left", "right"]), else: nil
          putts = 1
          score = par + Enum.random([0, 1])

          {score, putts, fw_status, "short", nil, true, true}
      end

    # Simulate Club Selection
    club_ids =
      cond do
        par == 3 ->
          # Par 3: Iron/Hybrid -> (Wedge if miss) -> Putter
          tee_shot = Enum.random(irons ++ hybrids)
          approach = if gir_status != "hit", do: [Enum.random(wedges)], else: []
          [tee_shot.id] ++ Enum.map(approach, & &1.id) ++ [putter.id]

        par == 4 ->
          # Par 4: Driver -> Iron/Wedge -> (Wedge if miss) -> Putter
          tee_shot = driver

          approach_club =
            if proximity && proximity < 150, do: Enum.random(wedges), else: Enum.random(irons)

          recovery = if gir_status != "hit", do: [Enum.random(wedges)], else: []
          [tee_shot.id, approach_club.id] ++ Enum.map(recovery, & &1.id) ++ [putter.id]

        par == 5 ->
          # Par 5: Driver -> Wood/Hybrid -> Wedge -> (Wedge if miss) -> Putter
          tee_shot = driver
          layup = Enum.random(woods ++ hybrids)
          approach_club = Enum.random(wedges)
          recovery = if gir_status != "hit", do: [Enum.random(wedges)], else: []
          [tee_shot.id, layup.id, approach_club.id] ++ Enum.map(recovery, & &1.id) ++ [putter.id]
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
      gir: gir_status == "hit",
      club_ids: club_ids
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
  holes: holes1,
  user_id: user.id
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
  holes: holes2,
  user_id: user.id
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
  holes: holes3,
  user_id: user.id
})
|> Repo.insert!()

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
  holes: holes1,
  user_id: user2.id
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
  holes: holes2,
  user_id: user2.id
})
|> Repo.insert!()


IO.puts("Seeded clubs and 3 rounds successfully!")
