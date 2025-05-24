// chartTQ1.js 

async function drawChartTQ1(containerSelector, tooltipElement, dataPath) { // ĐÃ SỬA: Thêm dataPath
    const vizContainer = d3.select(containerSelector);
    vizContainer.html(""); // Xóa nội dung cũ

    try {
        // Sử dụng dataPath được truyền vào để tải dữ liệu
        const allData = await d3.csv(dataPath);
        if (!allData || allData.length === 0) {
            throw new Error(`Không tải được file dữ liệu từ ${dataPath} hoặc file rỗng.`);
        }

        // 1. XỬ LÝ DỮ LIỆU:
        allData.forEach(d => {
            d.Sales = parseFloat(d.Sales);
            if (isNaN(d.Sales) || d.Sales < 0) d.Sales = 0;
            // (Kiểm tra lại tên cột trong CSV của bạn, có thể là 'country' thay vì 'Country')
            if (typeof d.Country === 'undefined' || d.Country === null || String(d.Country).trim() === "") {
                d.Country = "Không xác định";
            }
        });

        // Gom nhóm theo Country, tính tổng Sales
        const salesByCountryRollup = d3.rollup(allData,
            v => d3.sum(v, d => d.Sales),
            d => d.Country // Đảm bảo tên cột này chính xác trong CSV
        );

        let dataForChart = Array.from(salesByCountryRollup, ([key, value]) => ({
            Country: key,
            Total_Sales: value || 0
        }));

        // Lọc bỏ các quốc gia có Sales <= 0 hoặc không có tên
        dataForChart = dataForChart.filter(d => d.Total_Sales > 0 && d.Country !== "Không xác định");
        
        // Sắp xếp theo Total_Sales giảm dần và lấy top 10
        dataForChart.sort((a, b) => b.Total_Sales - a.Total_Sales);
        dataForChart = dataForChart.slice(0, 10); // Lấy Top 10

        if (dataForChart.length === 0) {
            vizContainer.html("<p>Không có dữ liệu Quốc gia hợp lệ để vẽ biểu đồ Top 10 Doanh thu (TQ1).</p>");
            return;
        }
        // console.log("Data for Top 10 Countries Bar Chart (TQ1):", dataForChart);

        // --- BẮT ĐẦU CODE D3.JS VẼ BIỂU ĐỒ CỘT NGANG ---
        const containerRect = vizContainer.node().getBoundingClientRect();
        const baseWidth = containerRect.width > 0 ? containerRect.width * 0.98 : 600;
        // Chiều cao động dựa trên số lượng thanh (10 thanh)
        const barHeightUnit = 30; // Chiều cao ước tính cho mỗi thanh + padding
        const baseHeight = dataForChart.length * barHeightUnit + 80; // 80 cho top/bottom margins

        const chartWidth = Math.max(400, baseWidth);
        const chartHeight = Math.max(250, baseHeight); // Chiều cao tối thiểu
        
        const margin = { top: 40, right: 50, bottom: 40, left: 150 }; // Tăng left margin cho tên Quốc gia

        const width = chartWidth - margin.left - margin.right;
        const height = chartHeight - margin.top - margin.bottom;

        const svg = vizContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Sắp xếp lại dữ liệu để thanh có Sales cao nhất ở trên cùng của biểu đồ ngang
        // (D3 scaleBand vẽ domain theo thứ tự được cung cấp từ trên xuống)
        // Vì dataForChart đã sort giảm dần theo Total_Sales (ở dòng 65), nên để Sales cao nhất ở trên,
        // domain của y scale phải là ngược lại của dataForChart đã sort. Hoặc sort lại dataForChart theo Total_Sales tăng dần ở đây.
        // Cách đơn giản nhất là đảo ngược range của Y scale:
        dataForChart.sort((a, b) => a.Total_Sales - b.Total_Sales); // Sắp xếp tăng dần để d3.scaleBand hiển thị đúng thứ tự từ trên xuống

        // Y Axis (Tên Quốc gia)
        const y = d3.scaleBand()
            .range([height, 0]) // Đảo range để Sales cao nhất ở trên cùng
            .domain(dataForChart.map(d => d.Country))
            .padding(0.2); 

        svg.append("g")
            .call(d3.axisLeft(y).tickSize(0).tickPadding(8))
            .selectAll("text")
                .style("font-size", "10px");
        
        svg.append("text") // Nhãn trục Y
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left + 15) 
            .attr("x", 0 - (height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle").style("font-size", "12px").style("fill", "#333")
            .text("Quốc gia");


        // X Axis (Doanh thu)
        const xMaxSales = d3.max(dataForChart, d => d.Total_Sales);
        const x = d3.scaleLinear()
            .domain([0, xMaxSales > 0 ? xMaxSales * 1.05 : 1000]) 
            .range([0, width]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(Math.min(5, width/80)).tickFormat(d3.format("~s"))) 
            .selectAll("text")
                .style("font-size", "10px");
        
        svg.append("text") // Nhãn trục X
            .attr("text-anchor", "middle").attr("x", width / 2).attr("y", height + margin.bottom - 5)
            .style("font-size", "12px").style("fill", "#333")
            .text("Doanh thu ($)");


        // Color Scale (palette='viridis' của Seaborn)
        // D3 có d3.interpolateViridis. Chúng ta có thể tạo một scaleOrdinal từ các màu của Viridis
        // Hoặc dùng một dải màu cố định nếu chỉ có 10 thanh.
        // Dùng schemeCategory10 hoặc một dải màu khác cho đơn giản
        const color = d3.scaleOrdinal(d3.schemeTableau10); 
        // Nếu muốn cố gắng giống viridis hơn cho từng thanh (phức tạp hơn cho bar chart):
        // const colorViridis = d3.scaleSequential(d3.interpolateViridis).domain([0, xMaxSales]);

        // Vẽ các thanh ngang
        const bars = svg.selectAll(".bar-tq1")
            .data(dataForChart)
            .join("rect")
              .attr("class", "bar-tq1")
              .attr("y", d => y(d.Country))
              .attr("x", x(0)) // Bắt đầu từ 0
              .attr("width", d => x(d.Total_Sales)) // Chiều rộng là giá trị Sales
              .attr("height", y.bandwidth())
              .attr("fill", (d,i) => color(d.Country)) // Tô màu theo Quốc gia, hoặc color(i) để tuần tự
              // .attr("fill", d => colorViridis(d.Total_Sales)) // Nếu dùng Viridis scale theo sales
              .style("cursor", "pointer");

        // Thêm text giá trị Sales trên hoặc gần mỗi thanh (tùy chọn)
        svg.selectAll(".bar-value-tq1")
            .data(dataForChart)
            .join("text")
            .attr("class", "bar-value-tq1")
            .attr("x", d => x(d.Total_Sales) + 5) // Bên phải của thanh một chút
            .attr("y", d => y(d.Country) + y.bandwidth() / 2)
            .attr("dy", "0.35em") // Căn giữa theo chiều dọc
            .style("text-anchor", "start") // Căn trái
            .style("font-size", "9px")
            .style("fill", "#333")
            .text(d => `$${d.Total_Sales.toLocaleString(undefined, {maximumFractionDigits:0})}`);
        
        // Tooltip
        bars
            .on("mouseover", function(event, d) {
                tooltipElement.transition().duration(100).style("opacity", .95);
                tooltipElement.html(
                    `<strong>Quốc gia: ${d.Country}</strong><br/>
                     Doanh thu: $${d.Total_Sales.toLocaleString(undefined, {maximumFractionDigits:0})}`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
                
                d3.select(this).style("filter", "brightness(0.85)");
            })
            .on("mouseout", function() {
                tooltipElement.transition().duration(300).style("opacity", 0);
                d3.select(this).style("filter", "brightness(1)");
            });

        // Tiêu đề cho biểu đồ
        svg.append("text")
            .attr("x", width / 2) 
            .attr("y", 0 - (margin.top / 2)) 
            .attr("text-anchor", "middle")
            .style("font-size", "16px").style("font-weight", "bold").style("fill", "#333")
            .text("Biểu đồ TQ1: Top 10 Doanh thu Quốc gia"); // ĐÃ SỬA: Thêm tiêu đề

    } catch (error) {
        vizContainer.html(`<p style='color:red;'>Lỗi khi vẽ Biểu đồ TQ1: ${error.message}</p>`);
        console.error("Lỗi drawChartTQ1:", error);
    }
}